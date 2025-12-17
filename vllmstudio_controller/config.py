"""Settings for the minimal controller."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8080

    api_key: Optional[str] = Field(default=None, description="Legacy single Bearer token (optional).")
    admin_key: Optional[str] = Field(default=None, description="Admin Bearer token for managing API keys.")

    inference_host: str = "localhost"
    inference_port: int = 8000
    proxy_port: int = 8001
    proxy_host: str = "localhost"

    data_dir: Path = Field(default=Path(__file__).resolve().parent.parent / "data")
    sqlite_path: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "controller.db")
    chats_db_path: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "chats.db")
    mcp_config_path: Path = Field(default=Path(__file__).resolve().parent.parent / "data" / "mcp_servers.json")

    models_dir: Path = Field(default=Path("/mnt/llm_models"))

    enable_openai_passthrough: bool = True
    enable_anthropic_passthrough: bool = True

    model_config = {
        "env_prefix": "VLLMSTUDIO_CONTROLLER_",
        "env_file": ".env",
        "extra": "ignore",
    }


settings = Settings()
