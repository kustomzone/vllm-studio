"""Backend registry with optional entrypoint discovery."""

from __future__ import annotations

from dataclasses import dataclass
from importlib import metadata
from typing import Dict, Iterable, Optional

from ..models import Backend
from .interface import InferenceBackend
from .sglang import SGLangBackend
from .vllm import VLLMBackend


ENTRYPOINT_GROUP = "vllmstudio.backends"


class BackendRegistry:
    """Mutable registry of inference backends."""

    def __init__(self):
        self._backends: Dict[str, InferenceBackend] = {}

    def register(self, backend: InferenceBackend) -> None:
        self._backends[backend.name] = backend

    def get(self, backend: Backend | str) -> InferenceBackend:
        key = backend.value if isinstance(backend, Backend) else str(backend)
        if key not in self._backends:
            raise KeyError(f"Unknown backend: {key}")
        return self._backends[key]

    def list(self) -> list[InferenceBackend]:
        return list(self._backends.values())

    def discover_entrypoints(self) -> None:
        """Discover and register backends published via entrypoints."""
        try:
            eps = metadata.entry_points()
        except Exception:
            return

        group = eps.select(group=ENTRYPOINT_GROUP) if hasattr(eps, "select") else eps.get(ENTRYPOINT_GROUP, [])
        for ep in group:
            try:
                obj = ep.load()
                backend = obj() if callable(obj) and not isinstance(obj, InferenceBackend) else obj
                if isinstance(backend, InferenceBackend):
                    self.register(backend)
            except Exception:
                continue


backend_registry = BackendRegistry()
backend_registry.register(VLLMBackend())
backend_registry.register(SGLangBackend())
backend_registry.discover_entrypoints()


def get_backend(backend: Backend | str) -> InferenceBackend:
    return backend_registry.get(backend)

