"""Root orchestrator agent that coordinates the full blog generation pipeline."""
from google.adk import Agent
from src.config import get_settings

settings = get_settings()

root_blogger = Agent(
    name="blogger",
    model=settings.google_model,
    description="Root orchestrator that plans, writes, and polishes blog posts.",
    instruction=(
        "You are a blog content manager. When given a topic:\n"
        "1. Use the 'plan_blog' tool to generate and validate an outline.\n"
        "2. Use the 'write_blog' tool to generate the full draft from the outline.\n"
        "3. Add 3 alternative catchy titles and a tweet-length hook (max 280 chars).\n"
        "4. Return the final blog post as formatted markdown.\n\n"
        "Always ensure the final output is polished, well-structured, and publication-ready."
    ),
)
