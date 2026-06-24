"""Tests for robust writer loop agent."""
import pytest
from src.agents.robust_writer import robust_blog_writer

def test_robust_writer_exists():
    assert robust_blog_writer is not None
    assert robust_blog_writer.name == "robust_blog_writer"

def test_robust_writer_has_retry_config():
    assert robust_blog_writer.retry_config is not None
    assert robust_blog_writer.retry_config.max_attempts == 3
