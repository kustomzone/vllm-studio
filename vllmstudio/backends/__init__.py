"""Inference backend interface and registry."""

from .interface import InferenceBackend
from .registry import backend_registry, get_backend

__all__ = ["InferenceBackend", "backend_registry", "get_backend"]

