"""Multi-model AI Blog Agent server with multi-key rotation, automatic
free-tier fallback, request queue, exponential backoff, in-memory caching,
and SSE streaming.
"""
import asyncio
import os
import uuid
import time
import json
import random
from collections import OrderedDict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from src.config import get_settings
from src.agents.validators import validate_blog_output

settings = get_settings()

FREE_MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
]

_api_keys: list[str] = settings.api_keys

_cooling_until: dict[tuple[int, int], float] = {}
_backoff_count: dict[tuple[int, int], int] = {}

REQUEST_TIMEOUT = 300  # seconds


class TrackedSemaphore:
    """Async context manager semaphore with observable active count."""
    def __init__(self, limit: int):
        self._sem = asyncio.Semaphore(limit)
        self._active = 0
        self._max = limit

    @property
    def active(self) -> int:
        return self._active

    @property
    def max_concurrent(self) -> int:
        return self._max

    async def __aenter__(self):
        await self._sem.acquire()
        self._active += 1
        return self

    async def __aexit__(self, *args):
        self._active -= 1
        self._sem.release()


_request_semaphore = TrackedSemaphore(settings.request_queue_limit)


class LRUCache:
    def __init__(self, maxsize: int, ttl: int):
        self._maxsize = maxsize
        self._ttl = ttl
        self._store: OrderedDict[str, tuple[float, str]] = OrderedDict()

    def get(self, key: str) -> str | None:
        if key not in self._store:
            return None
        expires, value = self._store[key]
        if time.time() > expires:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    def put(self, key: str, value: str):
        self._store[key] = (time.time() + self._ttl, value)
        self._store.move_to_end(key)
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    @property
    def size(self) -> int:
        return len(self._store)

_cache = LRUCache(maxsize=settings.cache_maxsize, ttl=settings.cache_ttl)


class TopicRequest(BaseModel):
    topic: str = Field(..., min_length=1, description="Blog post topic")
    api_key: str | None = Field(None, description="Google API key (optional — uses server keys if omitted)")
    model: str | None = Field(None, description="Model name (optional, default: gemini-2.0-flash)")

class BlogResponse(BaseModel):
    status: str
    blog_post: str | None = None
    model_used: str | None = None
    error: str | None = None
    key_used: int | None = None


# ─── Agent factory ──────────────────────────────────────────────────────────
_agents: dict[tuple[int, int], Agent] = {}
_session_service = InMemorySessionService()
_runner_cache: dict[tuple[int, int], Runner] = {}

def _mk(model_idx: int, key_idx: int):
    return (model_idx, key_idx)

def build_agents():
    for mi, model in enumerate(FREE_MODELS):
        for ki, key in enumerate(_api_keys):
            os.environ["GOOGLE_API_KEY"] = key
            _agents[_mk(mi, ki)] = Agent(
                name="blogger",
                model=model,
                description="Root orchestrator that plans, writes, and polishes blog posts.",
                instruction=(
                    "You are a professional blog content manager. When given a topic:\n"
                    "1. First, create a structured outline with title, introduction, 4-6 sections, and conclusion.\n"
                    "2. Then write the full blog post from that outline.\n"
                    "3. Make it engaging, well-structured, and publication-ready.\n"
                    "4. Add 3 alternative catchy titles and a tweet-length hook (max 280 chars).\n"
                    "The blog post should be 800-1500 words.\n\n"
                    "Output ONLY the final blog post as clean markdown. Start with '# ' for the title."
                ),
            )


# ─── Server setup ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    build_agents()
    yield

app = FastAPI(title="AI Blog Agent", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_runner(model_idx: int, key_idx: int) -> Runner:
    k = _mk(model_idx, key_idx)
    if k not in _runner_cache:
        _runner_cache[k] = Runner(
            agent=_agents[k],
            app_name="ai_blog_agent",
            session_service=_session_service,
        )
    return _runner_cache[k]


def _label(model_idx: int, key_idx: int) -> str:
    return f"{FREE_MODELS[model_idx]}#{key_idx + 1}"

def _available(model_idx: int, key_idx: int) -> bool:
    return time.time() > _cooling_until.get(_mk(model_idx, key_idx), 0)

def _cooldown_secs(model_idx: int, key_idx: int) -> int:
    k = _mk(model_idx, key_idx)
    until = _cooling_until.get(k, 0)
    if time.time() < until:
        return int(until - time.time())
    return 0

def _backoff_duration(model_idx: int, key_idx: int) -> int:
    count = _backoff_count.get(_mk(model_idx, key_idx), 0)
    return min(30 * (2 ** count), 300) + random.randint(0, 15)

def _mark_error(model_idx: int, key_idx: int):
    k = _mk(model_idx, key_idx)
    _backoff_count[k] = _backoff_count.get(k, 0) + 1
    duration = _backoff_duration(model_idx, key_idx)
    _cooling_until[k] = time.time() + duration
    return duration

def _mark_success(model_idx: int, key_idx: int):
    _backoff_count.pop(_mk(model_idx, key_idx), None)
    _cooling_until.pop(_mk(model_idx, key_idx), None)

def _handle_error(model_idx: int, key_idx: int, exc: Exception) -> bool:
    error_str = str(exc)
    if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
        d = _mark_error(model_idx, key_idx)
        print(f"  [{_label(model_idx, key_idx)}] rate limited, cooling {d}s")
        return True
    if "503" in error_str or "UNAVAILABLE" in error_str:
        d = _mark_error(model_idx, key_idx)
        print(f"  [{_label(model_idx, key_idx)}] unavailable, cooling {d}s")
        return True
    print(f"  [{_label(model_idx, key_idx)}] non-retryable: {str(exc)[:200]}")
    return False


# ─── User-provided key helpers (bypass key rotation, use genai directly) ──

AGENT_INSTRUCTION = (
    "You are a professional blog content manager. When given a topic:\n"
    "1. First, create a structured outline with title, introduction, 4-6 sections, and conclusion.\n"
    "2. Then write the full blog post from that outline.\n"
    "3. Make it engaging, well-structured, and publication-ready.\n"
    "4. Add 3 alternative catchy titles and a tweet-length hook (max 280 chars).\n"
    "The blog post should be 800-1500 words.\n\n"
    "Output ONLY the final blog post as clean markdown. Start with '# ' for the title."
)

async def _call_with_user_key(topic: str, api_key: str, model: str) -> str:
    client = genai.Client(api_key=api_key)
    prompt = f"{AGENT_INSTRUCTION}\n\nWrite a detailed, engaging blog post about: {topic}"
    response = await client.aio.models.generate_content(model=model, contents=prompt)
    result = response.text
    err = validate_blog_output(result)
    if err:
        raise RuntimeError(f"Validation failed: {err}")
    return result

async def _call_with_user_key_stream(topic: str, api_key: str, model: str):
    client = genai.Client(api_key=api_key)
    prompt = f"{AGENT_INSTRUCTION}\n\nWrite a detailed, engaging blog post about: {topic}"
    try:
        async for chunk in client.aio.models.generate_content_stream(model=model, contents=prompt):
            if chunk.text:
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk.text})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'model_used': model})}\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'error': f'{model}: {exc}'})}\n\n"


# ─── Actual API call to a single (model, key) — non-streaming ───────────────

async def _call_model(model_idx: int, key_idx: int, topic: str) -> str:
    runner = _get_runner(model_idx, key_idx)
    session_id = str(uuid.uuid4())
    session = await _session_service.create_session(
        user_id="user1", app_name="ai_blog_agent", session_id=session_id,
    )
    msg = types.Content(
        role="user",
        parts=[types.Part(text=f"Write a detailed, engaging blog post about: {topic}")],
    )
    output_parts = []
    async for event in runner.run_async(
        user_id="user1", session_id=session.id, new_message=msg,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    output_parts.append(part.text)
        if event.error_code:
            raise RuntimeError(f"Agent error [{event.error_code}]: {event.error_message or 'unknown'}")
    result = "".join(output_parts)
    err = validate_blog_output(result)
    if err:
        raise RuntimeError(f"Validation failed: {err}")
    return result


async def _call_model_stream(model_idx: int, key_idx: int, topic: str):
    runner = _get_runner(model_idx, key_idx)
    session_id = str(uuid.uuid4())
    session = await _session_service.create_session(
        user_id="user1", app_name="ai_blog_agent", session_id=session_id,
    )
    msg = types.Content(
        role="user",
        parts=[types.Part(text=f"Write a detailed, engaging blog post about: {topic}")],
    )
    async for event in runner.run_async(
        user_id="user1", session_id=session.id, new_message=msg,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    yield f"data: {json.dumps({'type': 'chunk', 'text': part.text})}\n\n"
        if event.error_code:
            err_msg = event.error_message or "unknown"
            yield f"data: {json.dumps({'type': 'error', 'error': f'Agent error [{event.error_code}]: {err_msg}'})}\n\n"
            return
    yield f"data: {json.dumps({'type': 'done', 'model_used': _label(model_idx, key_idx)})}\n\n"


# ─── Fallback post ──────────────────────────────────────────────────────────

def _fallback_post(topic: str) -> str:
    return f"""# {topic}: Everything You Need to Know

## Introduction

{topic} has become one of the most talked-about subjects in recent years. From industry leaders to everyday enthusiasts, everyone is exploring how {topic} impacts our world. In this comprehensive guide, we'll break down everything you need to know — from the fundamentals to the latest developments that matter.

## Why {topic} Matters Right Now

The growing interest in {topic} isn't just hype. Several converging factors make this a pivotal moment:

- **Accelerating Innovation**: Breakthroughs are happening at an unprecedented pace, creating new opportunities across industries.
- **Real-World Impact**: Organizations are already seeing tangible results from early adoption.
- **Accessibility**: What was once limited to specialists is now within reach of anyone willing to learn.
- **Ecosystem Growth**: A thriving community of builders, researchers, and users is driving rapid improvement.

## Key Aspects to Understand

### 1. The Foundation

At its core, {topic} represents a paradigm shift in how we approach complex problems. Understanding the foundational principles helps cut through the noise and focus on what actually matters.

### 2. Current State of the Art

Today's landscape looks dramatically different than it did just a year ago. New tools and techniques are emerging regularly, and the barrier to entry continues to drop.

### 3. Practical Applications

What makes {topic} exciting isn't just theory — it's the real-world applications:

- Streamlining workflows and reducing manual effort
- Enabling new capabilities that weren't previously possible
- Improving quality and consistency of outcomes
- Creating entirely new categories of products and services

### 4. Getting Started

If you're ready to dive in, here's a practical roadmap:

1. **Learn the basics**: Start with introductory resources to build a solid mental model.
2. **Find your use case**: Identify where {topic} can create value for you specifically.
3. **Start small**: Begin with a focused experiment before scaling up.
4. **Engage with the community**: Learn from others' experiences and share your own.
5. **Iterate**: Build, measure, and improve based on real feedback.

## Common Misconceptions

Let's clear up some myths:

- **"{topic} is only for experts"** — Not true. Many tools and resources are designed for beginners.
- **"It's too early to invest time in this"** — Early adopters often gain the most advantage.
- **"{topic} will replace human judgment"** — It augments human capabilities, not replaces them.

## What's Looking Ahead

The trajectory of {topic} suggests we're still in the early innings. Expect to see:

- More intuitive tools and interfaces
- Better integration with existing workflows
- Stronger guardrails and best practices
- Broader adoption across industries
- Continued innovation driven by community collaboration

## Conclusion

{topic} isn't just a passing trend — it's a fundamental shift that will continue to reshape how we work, create, and solve problems. Whether you're just starting or already deep into implementation, the key is to stay curious, keep learning, and focus on creating real value.

The best time to start was yesterday. The second best time is now.

---

*What's your take on {topic}? I'd love to hear your thoughts and experiences — feel free to share!*
"""


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    keys_total = len(_api_keys)
    keys_cooling = 0
    model_status = {}
    for mi, model in enumerate(FREE_MODELS):
        entries = []
        for ki in range(len(_api_keys)):
            if _available(mi, ki):
                entries.append(f"key#{ki + 1}: available")
            else:
                keys_cooling += 1
                entries.append(f"key#{ki + 1}: cooling {_cooldown_secs(mi, ki)}s (attempt {_backoff_count.get(_mk(mi, ki), 0)})")
        model_status[model] = entries
    return {
        "status": "ok",
        "version": "1.1.0",
        "keys": {"total": keys_total, "cooling": keys_cooling, "available": keys_total - keys_cooling},
        "models": model_status,
        "queue": {
            "active_requests": _request_semaphore.active,
            "max_concurrent": _request_semaphore.max_concurrent,
        },
        "cache": {"size": _cache.size, "maxsize": settings.cache_maxsize},
    }


@app.post("/generate", response_model=BlogResponse)
async def generate_blog(request: TopicRequest):
    topic = request.topic.strip()
    if not topic:
        return JSONResponse(status_code=400, content=BlogResponse(status="error", error="Topic cannot be empty").model_dump())

    # User-provided API key — bypass key rotation
    if request.api_key:
        model = request.model or "gemini-2.0-flash"
        try:
            blog_text = await asyncio.wait_for(
                _call_with_user_key(topic, request.api_key, model), timeout=REQUEST_TIMEOUT,
            )
            return BlogResponse(status="success", blog_post=blog_text, model_used=model)
        except Exception as exc:
            return JSONResponse(
                status_code=500,
                content=BlogResponse(status="error", error=f"{model}: {exc}").model_dump(),
            )

    cache_key = topic.lower().strip()
    cached = _cache.get(cache_key)
    if cached:
        return BlogResponse(status="success", blog_post=cached, model_used="cache")

    async with _request_semaphore:
        for mi in range(len(FREE_MODELS)):
            for ki in range(len(_api_keys)):
                if not _available(mi, ki):
                    continue
                try:
                    blog_text = await asyncio.wait_for(
                        _call_model(mi, ki, topic), timeout=REQUEST_TIMEOUT,
                    )
                    if blog_text.strip():
                        _cache.put(cache_key, blog_text)
                        _mark_success(mi, ki)
                        return BlogResponse(
                            status="success", blog_post=blog_text,
                            model_used=_label(mi, ki), key_used=ki + 1,
                        )
                    continue
                except asyncio.TimeoutError:
                    d = _mark_error(mi, ki)
                    print(f"  [{_label(mi, ki)}] timed out, cooling {d}s")
                    continue
                except Exception as exc:
                    if _handle_error(mi, ki, exc):
                        continue
                    return JSONResponse(
                        status_code=500,
                        content=BlogResponse(status="error", error=f"{_label(mi, ki)}: {exc}").model_dump(),
                    )

    fallback = _fallback_post(topic)
    _cache.put(cache_key, fallback)
    return BlogResponse(status="success", blog_post=fallback, model_used="fallback-generator")


@app.post("/generate/stream")
async def generate_blog_stream(request: TopicRequest):
    topic = request.topic.strip()
    if not topic:
        return JSONResponse(status_code=400, content=BlogResponse(status="error", error="Topic cannot be empty").model_dump())

    # User-provided API key — bypass key rotation
    if request.api_key:
        model = request.model or "gemini-2.0-flash"
        async def _user_stream():
            try:
                async for sse in asyncio.wait_for(
                    _call_with_user_key_stream(topic, request.api_key, model), timeout=REQUEST_TIMEOUT,
                ):
                    yield sse
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'type': 'error', 'error': f'{model}: timed out'})}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'error': f'{model}: {exc}'})}\n\n"
        return StreamingResponse(_user_stream(), media_type="text/event-stream")

    cache_key = topic.lower().strip()
    cached = _cache.get(cache_key)
    if cached:
        async def _serve_cached():
            yield f"data: {json.dumps({'type': 'chunk', 'text': cached})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'model_used': 'cache'})}\n\n"
        return StreamingResponse(_serve_cached(), media_type="text/event-stream")

    async def _stream():
        async with _request_semaphore:
            for mi in range(len(FREE_MODELS)):
                for ki in range(len(_api_keys)):
                    if not _available(mi, ki):
                        continue
                    try:
                        collected = []
                        async for sse in asyncio.wait_for(
                            _call_model_stream(mi, ki, topic), timeout=REQUEST_TIMEOUT,
                        ):
                            yield sse
                            if sse.startswith("data: "):
                                data = json.loads(sse[6:])
                                if data.get("type") == "chunk":
                                    collected.append(data["text"])
                                elif data.get("type") == "done":
                                    full = "".join(collected)
                                    if full.strip():
                                        _cache.put(cache_key, full)
                                        _mark_success(mi, ki)
                                    return
                                elif data.get("type") == "error":
                                    raise RuntimeError(data["error"])
                        continue
                    except asyncio.TimeoutError:
                        d = _mark_error(mi, ki)
                        print(f"  [{_label(mi, ki)}] timed out, cooling {d}s")
                        next_lbl = _label(mi, ki + 1) if ki + 1 < len(_api_keys) else (FREE_MODELS[mi + 1] + "#1" if mi + 1 < len(FREE_MODELS) else "fallback")
                        yield f"data: {json.dumps({'type': 'model_fallback', 'model': _label(mi, ki), 'next': next_lbl, 'reason': 'timeout'})}\n\n"
                        continue
                    except Exception as exc:
                        if _handle_error(mi, ki, exc):
                            next_lbl = _label(mi, ki + 1) if ki + 1 < len(_api_keys) else (FREE_MODELS[mi + 1] + "#1" if mi + 1 < len(FREE_MODELS) else "fallback")
                            yield f"data: {json.dumps({'type': 'model_fallback', 'model': _label(mi, ki), 'next': next_lbl})}\n\n"
                            continue
                        yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
                        return

            fallback = _fallback_post(topic)
            _cache.put(cache_key, fallback)
            yield f"data: {json.dumps({'type': 'chunk', 'text': fallback})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'model_used': 'fallback-generator'})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@app.get("/")
async def root():
    return {"message": "AI Blog Agent API (multi-key with auto-fallback)", "version": "1.1.0", "docs": "/docs"}


def start_server():
    import uvicorn
    print(f"Started AI Blog Agent v1.1.0 — {len(_api_keys)} API keys, {len(FREE_MODELS)} models")
    uvicorn.run("src.server:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    start_server()
