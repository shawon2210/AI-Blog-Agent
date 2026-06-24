"""Configuration management for the AI Blog Agent."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_model: str = "gemini-2.0-flash"
    google_api_key: str = ""
    max_retries: int = 3
    host: str = "0.0.0.0"
    port: int = 8080

    model_config = {"env_file": ".env"}


def get_settings() -> Settings:
    return Settings()
