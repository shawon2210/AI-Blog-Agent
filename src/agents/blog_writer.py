"""Blog writer agent that converts outline to full post."""
from google.adk import Agent
from src.config import get_settings

settings = get_settings()

blog_writer = Agent(
    name="blog_writer",
    model=settings.google_model,
    description="Writes a full blog post from a validated outline.",
    instruction=(
        "You are a professional blog writer. Given a blog_outline (JSON with title, introduction, sections, conclusion), "
        "write a complete markdown blog post. Each section should be 2-3 paragraphs. "
        "Output ONLY valid JSON: {\"content\": \"<full markdown text>\"}"
    ),
    output_key="blog_draft",
)
