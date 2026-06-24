import pytest
from src.config import get_settings

def test_config_loads():
    settings = get_settings()
    assert settings.google_model == "gemini-2.0-flash"
