from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .config import Settings


def load_settings(config_path: Optional[str]) -> Settings:
    """Load settings from JSON config file + env defaults.

    Precedence:
    - JSON config values (if provided)
    - env vars / .env (pydantic-settings)
    - class defaults
    """
    if not config_path:
        return Settings()

    data = json.loads(Path(config_path).read_text())
    if not isinstance(data, dict):
        raise ValueError("Config file must contain a JSON object")
    return Settings(**data)

