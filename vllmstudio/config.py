"""Configuration for vLLM Studio."""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings."""

    # Paths
    models_dir: Path = Field(default=Path("/mnt/llm_models"))
    recipes_dir: Path = Field(default=Path(__file__).parent.parent / "recipes")

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8080

    # Authentication - set API_KEY env var to enable
    api_key: Optional[str] = Field(default=None, description="API key for authentication (like OpenAI)")

    # Backend settings
    vllm_port: int = 8000
    proxy_port: int = 8001
    proxy_host: str = "localhost"

    # Process management
    default_gpu_count: int = 8

    # Optional token pricing (USD per 1k tokens), JSON string like:
    # {"default": {"prompt_per_1k": 0.0, "completion_per_1k": 0.0}, "gpt-4o": {"prompt_per_1k": 0.005, "completion_per_1k": 0.015}}
    token_pricing_json: Optional[str] = None

    model_config = {
        "env_prefix": "VLLMSTUDIO_",
        "env_file": ".env",
    }


settings = Settings()
