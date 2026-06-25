# AI Blog Agent

A production-ready multi-agent blog writing system powered by Google's Agent Development Kit (ADK) and Gemini models. Generates publication-ready blog posts from a topic prompt with automatic failover, rate-limit handling, and SSE streaming.

[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Google ADK](https://img.shields.io/badge/Google%20ADK-0.1+-orange.svg)](https://google.adk)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Features

- **Multi-key rotation** — distribute requests across multiple API keys with automatic failover
- **Free-tier fallback** — automatically cycles through `gemini-2.0-flash-lite`, `gemini-2.0-flash`, and `gemini-2.5-flash`
- **Exponential backoff** — intelligent cooling on 429/503 errors per (model, key) pair
- **Request queue** — configurable concurrency limit (default 3) with backpressure
- **LRU cache** — in-memory cache (configurable TTL and max size) to avoid duplicate API calls
- **SSE streaming** — real-time blog generation via Server-Sent Events
- **Fallback generator** — built-in template-based fallback when all models are exhausted
- **Dark-themed SPA** — React frontend with responsive design, markdown rendering, and streaming support

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12+, FastAPI, Google ADK, Google GenAI |
| **Frontend** | React 18, Vite 5 |
| **AI Models** | Gemini 2.0 Flash / Flash-Lite / 2.5 Flash |
| **Config** | Pydantic Settings, python-dotenv |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- A Google AI API key (get one at [aistudio.google.com](https://aistudio.google.com))

### Setup

```bash
# Clone
git clone https://github.com/shawon2210/AI-Blog-Agent.git
cd AI-Blog-Agent

# Backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -e ".[dev]"

# Configure API keys
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY or GOOGLE_API_KEYS (separate multiple keys with >>)

# Run server
python -m src

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Multiple API Keys

Separate keys with `>>` in your `.env`:

```ini
GOOGLE_API_KEYS=key1>>key2>>key3
GOOGLE_MODEL=gemini-2.0-flash
```

### Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:8080 |
| Health Check | http://localhost:8080/health |
| Generate | `POST /generate` |
| Generate (Stream) | `POST /generate/stream` |

---

## API Endpoints

### `GET /health`

Returns server status, API key availability, model cooling states, queue depth, and cache stats.

### `POST /generate`

```json
// Request
{ "topic": "The future of AI in healthcare" }

// Response
{ "status": "success", "blog_post": "# ...", "model_used": "gemini-2.0-flash#1" }
```

### `POST /generate/stream`

Returns a Server-Sent Events stream:

```
data: {"type": "chunk", "text": "## Introduction\\n\\n..."}
data: {"type": "chunk", "text": "The future of AI..."}
data: {"type": "done", "model_used": "gemini-2.0-flash#1"}
```

On failover:
```
data: {"type": "model_fallback", "model": "gemini-2.0-flash#1", "next": "gemini-2.5-flash#1"}
```

---

## Testing

```bash
python -m pytest tests/ -v
```

Includes tests for config loading, validators, agent orchestration, robustness workflows, and HTTP endpoints.

---

## Project Structure

```
ai-blog-agent/
├── src/
│   ├── __main__.py        # Entry point
│   ├── config.py          # Pydantic settings (API keys, model, server)
│   ├── models.py          # Pydantic models (BlogOutline, BlogDraft, AgentState)
│   ├── server.py          # FastAPI server (488 lines)
│   └── agents/
│       ├── validators.py  # Blog output validation functions
│       ├── blog_planner.py
│       ├── blog_writer.py
│       ├── orchestrator.py
│       ├── robust_planner.py
│       └── robust_writer.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main SPA (450 lines)
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── tests/
│   ├── test_config.py
│   ├── test_validators.py
│   ├── test_blog_writer.py
│   ├── test_orchestrator.py
│   ├── test_robust_planner.py
│   ├── test_robust_writer.py
│   └── test_server.py
├── pyproject.toml
└── .env.example
```

---

## Configuration

All settings via environment variables (`.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | — | Single API key |
| `GOOGLE_API_KEYS` | — | Multiple keys (separated by `>>`) |
| `GOOGLE_MODEL` | `gemini-2.0-flash` | Primary model |
| `MAX_RETRIES` | `3` | Max retries per (model, key) |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8080` | Server port |
| `CACHE_TTL` | `3600` | Cache TTL in seconds |
| `CACHE_MAXSIZE` | `50` | Max cached entries |
| `REQUEST_QUEUE_LIMIT` | `3` | Max concurrent requests |

---

## License

MIT
