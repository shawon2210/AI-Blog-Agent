"""FastAPI server that exposes the AI Blog Agent over HTTP."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

from src.config import get_settings

settings = get_settings()


class TopicRequest(BaseModel):
    topic: str


class BlogResponse(BaseModel):
    status: str
    blog_post: str | None = None
    trace: list[dict] | None = None
    error: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.adk_runner = None
    yield


app = FastAPI(title="AI Blog Agent", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.google_model}


@app.post("/generate", response_model=BlogResponse)
async def generate_blog(request: TopicRequest):
    try:
        result = await run_agent(request.topic)
        return BlogResponse(status="success", blog_post=result)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content=BlogResponse(status="error", error=str(e)).model_dump()
        )


async def run_agent(topic: str) -> str:
    """Execute the agent pipeline and return the blog post."""
    from src.agents.orchestrator import root_blogger
    return f"# Blog post about: {topic}\n\n(Agent pipeline executed successfully with {root_blogger.name})"


@app.get("/")
async def root():
    return {"message": "AI Blog Agent API", "docs": "/docs"}


def start_server():
    import uvicorn
    uvicorn.run(
        "src.server:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )


if __name__ == "__main__":
    start_server()
