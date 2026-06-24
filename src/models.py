"""Data models for the AI Blog Agent."""
from pydantic import BaseModel


class BlogOutline(BaseModel):
    title: str
    introduction: str
    sections: list[str]
    conclusion: str


class BlogDraft(BaseModel):
    outline: BlogOutline
    content: str


class AgentState(BaseModel):
    topic: str = ""
    blog_outline: BlogOutline | None = None
    blog_draft: BlogDraft | None = None
    retry_count: int = 0
    errors: list[str] = []
