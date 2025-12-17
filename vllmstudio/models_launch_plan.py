"""Models for recipe launch-plan previews."""

from __future__ import annotations

from typing import Dict, List

from pydantic import BaseModel

from .models import Backend, Recipe


class LaunchPlan(BaseModel):
    """Fully-resolved plan of what will be launched for a recipe."""

    recipe: Recipe
    backend: Backend
    command: List[str]
    env: Dict[str, str]
    log_file: str

