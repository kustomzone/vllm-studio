"""Registry and factory for proxy adapters.

Allows mapping model identifiers/patterns to adapter kinds (minimax, glm, mistral, default)
and optionally associates per-adapter virtualenvs or environment overrides.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class AdapterKind(str, Enum):
    """Supported proxy adapter kinds."""

    MINIMAX = "minimax"
    GLM = "glm"
    MISTRAL = "mistral"
    DEFAULT = "default"


@dataclass
class AdapterSpec:
    """Adapter definition for a model family."""

    name: str
    kind: AdapterKind
    patterns: List[str] = field(default_factory=list)
    venv_path: Optional[str] = None
    env: Dict[str, str] = field(default_factory=dict)

    def matches(self, model_name: str) -> bool:
        """Return True if this adapter should handle the model."""
        model_lower = (model_name or "").lower()
        for pattern in self.patterns:
            if pattern and pattern.lower() in model_lower:
                return True
        return False


class AdapterRegistry:
    """Mutable registry of proxy adapters."""

    def __init__(self):
        self._adapters: List[AdapterSpec] = []

    def register(self, adapter: AdapterSpec) -> None:
        self._adapters.append(adapter)

    def clear(self) -> None:
        self._adapters.clear()

    def match(self, model_name: str) -> Optional[AdapterSpec]:
        """Find the first adapter whose pattern matches the model name."""
        for adapter in self._adapters:
            if adapter.matches(model_name):
                return adapter
        return None

    def list(self) -> List[AdapterSpec]:
        return list(self._adapters)


def register_default_adapters(registry: AdapterRegistry, settings) -> None:
    """Populate registry with built-in adapters based on settings patterns."""
    registry.clear()
    registry.register(
        AdapterSpec(
            name="minimax",
            kind=AdapterKind.MINIMAX,
            patterns=settings.minimax_model_patterns,
            venv_path=getattr(settings, "minimax_venv", None),
        )
    )
    registry.register(
        AdapterSpec(
            name="glm",
            kind=AdapterKind.GLM,
            patterns=settings.glm_model_patterns,
            venv_path=getattr(settings, "glm_venv", None),
        )
    )
    registry.register(
        AdapterSpec(
            name="mistral",
            kind=AdapterKind.MISTRAL,
            patterns=settings.mistral_model_patterns,
            venv_path=getattr(settings, "mistral_venv", None),
        )
    )


# Global singleton registry
adapter_registry = AdapterRegistry()
