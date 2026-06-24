"""Blog planner agent that generates structured outlines."""
from google.adk import Agent
from src.config import get_settings

settings = get_settings()

blog_planner = Agent(
    name="blog_planner",
    model=settings.google_model,
    description="Generates a structured blog post outline from a topic.",
    instruction=(
        "You are a professional blog content planner. Given a topic, produce a JSON outline with:\n"
        "- title: catchy blog post title\n"
        "- introduction: 1-2 sentence intro\n"
        "- sections: list of 4-6 section headings with bullet points\n"
        "- conclusion: 1-2 sentence conclusion\n\n"
        "Output ONLY valid JSON matching: {\"title\": ..., \"introduction\": ..., \"sections\": [...], \"conclusion\": ...}"
    ),
    output_key="blog_outline",
)
