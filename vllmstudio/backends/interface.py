"""Backend interface for launching and managing inference servers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

from ..models import Recipe


@dataclass(frozen=True)
class BackendCapabilities:
    """Advertised backend capabilities for UI/validation."""

    streaming: bool = True
    tools: bool = True
    metrics: bool = True
    health_endpoint: bool = True


class InferenceBackend(ABC):
    """Contract for a single inference backend implementation."""

    name: str
    capabilities: BackendCapabilities = BackendCapabilities()

    @abstractmethod
    def build_launch_command(self, recipe: Recipe) -> list[str]:
        """Return argv to launch this backend for the given recipe."""

    def build_launch_env(self, recipe: Recipe) -> Dict[str, str]:
        """Return environment variables to set for launch."""
        env: Dict[str, str] = {}
        if recipe.cuda_visible_devices:
            env["CUDA_VISIBLE_DEVICES"] = recipe.cuda_visible_devices
        if recipe.env_vars:
            env.update(recipe.env_vars)
        return env

    def default_log_file(self, recipe_id: str) -> Path:
        """Return the default log path used for a launched process."""
        return Path(f"/tmp/vllm_{recipe_id}.log")

    def health_url(self, *, host: str = "localhost", port: int) -> str:
        """Return a URL used to check backend readiness."""
        return f"http://{host}:{port}/health"

    async def tokenize(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Optional backend-native tokenization hook (defaults to None)."""
        return None

