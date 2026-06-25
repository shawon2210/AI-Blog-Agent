"""Validation agents for self-correction loops."""
from src.models import BlogOutline


def validate_outline(outline: BlogOutline | None) -> bool:
    if outline is None:
        return False
    if not outline.title or not outline.title.strip():
        return False
    if not outline.introduction or not outline.introduction.strip():
        return False
    if len(outline.sections) < 4:
        return False
    if not outline.conclusion or not outline.conclusion.strip():
        return False
    return True


def validate_draft(draft) -> bool:
    if draft is None:
        return False
    if not draft.content or len(draft.content.strip()) < 200:
        return False
    return True


def validate_blog_output(text: str | None) -> str | None:
    """Validate the final blog post string. Returns an error message or None."""
    if not text or not text.strip():
        return "Blog post is empty"
    stripped = text.strip()
    if len(stripped) < 100:
        return f"Blog post too short ({len(stripped)} chars, min 100)"
    if not stripped.startswith("#"):
        return "Blog post missing markdown title (#)"
    return None
