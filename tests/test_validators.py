import pytest
from src.models import BlogOutline
from src.agents.validators import validate_outline

def test_validate_valid_outline():
    outline = BlogOutline(
        title="Test Title",
        introduction="Intro text",
        sections=["Section 1", "Section 2", "Section 3", "Section 4"],
        conclusion="Conclusion text"
    )
    assert validate_outline(outline) is True

def test_validate_invalid_outline():
    outline = BlogOutline(
        title="",
        introduction="Intro",
        sections=["Section 1"],
        conclusion="Conclusion"
    )
    assert validate_outline(outline) is False
