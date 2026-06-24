"""Tests for root orchestrator agent."""
import pytest
from src.agents.orchestrator import root_blogger

def test_orchestrator_exists():
    assert root_blogger is not None
    assert root_blogger.name == "blogger"
