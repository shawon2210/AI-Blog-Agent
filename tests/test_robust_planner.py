"""Tests for robust planner loop agent."""
import pytest
from src.agents.robust_planner import robust_blog_planner

def test_robust_planner_exists():
    assert robust_blog_planner is not None
    assert robust_blog_planner.name == "robust_blog_planner"

def test_robust_planner_has_retry_config():
    assert robust_blog_planner.retry_config is not None
    assert robust_blog_planner.retry_config.max_attempts == 3
