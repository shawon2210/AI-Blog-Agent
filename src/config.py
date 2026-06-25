"""Configuration management for the AI Blog Agent."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_model: str = "gemini-2.0-flash"
    google_api_key: str = ""
    google_api_keys: str = ""
    max_retries: int = 3
    host: str = "0.0.0.0"
    port: int = 8080
    cache_ttl: int = 3600
    cache_maxsize: int = 50
    request_queue_limit: int = 3

    model_config = {"env_file": ".env"}

    @property
    def api_keys(self) -> list[str]:
        keys_str = self.google_api_keys or self.google_api_key
        keys = [k.strip() for k in keys_str.replace(";", "\n").replace(">>", "\n").split("\n") if k.strip()]
        return keys if keys else [self.google_api_key]

def get_settings() -> Settings:
    return Settings()
