"""Root orchestrator agent that coordinates the full blog generation pipeline
using sub-agents for planning and writing with validation and retry.
"""
from google.adk import Agent
from src.config import get_settings
from src.agents.blog_planner import blog_planner
from src.agents.blog_writer import blog_writer

settings = get_settings()

root_blogger = Agent(
    name="blogger",
    model=settings.google_model,
    description="Root orchestrator that plans, writes, and polishes blog posts.",
    instruction=(
        "You are a professional blog content manager. When given a topic:\n"
        "1. Create a structured outline (title, introduction, 4-6 sections, conclusion).\n"
        "2. Write a full blog post from that outline (800-1500 words, engaging, publication-ready).\n"
        "3. Add 3 alternative catchy titles and a tweet-length hook (max 280 chars).\n"
        "4. Return the final blog post as formatted markdown starting with '# '.\n\n"
        "Always ensure the final output is polished, well-structured, and publication-ready."
    ),
    sub_agents=[blog_planner, blog_writer],
)
