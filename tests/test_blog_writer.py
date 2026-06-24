import pytest
from src.agents.blog_writer import blog_writer

def test_writer_agent_exists():
    assert blog_writer is not None
    assert blog_writer.name == "blog_writer"
    assert blog_writer.output_key == "blog_draft"
