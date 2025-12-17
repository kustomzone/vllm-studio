"""Unsupported backend placeholder (recipes can exist but cannot be launched yet)."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import Recipe
from .interface import InferenceBackend


@dataclass(frozen=True)
class UnsupportedBackend(InferenceBackend):
    name: str
    hint: str = "Unsupported backend"

    def build_launch_command(self, recipe: Recipe) -> list[str]:
        _ = recipe
        # Launching via this backend is intentionally not implemented.
        # The controller will treat this as an immediate failure.
        return ["bash", "-lc", f"echo '{self.hint}: {self.name}' 1>&2; exit 1"]

