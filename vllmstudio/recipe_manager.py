"""Recipe management for vLLM Studio."""

import json
from pathlib import Path
from typing import Dict, List, Optional

from .models import Recipe, RecipeWithStatus, RecipeStatus
from .config import settings
from .process_manager import ProcessManager


class RecipeManager:
    """Manages model recipes."""

    def __init__(self, recipes_dir: Optional[Path] = None):
        self.recipes_dir = recipes_dir or settings.recipes_dir
        self.recipes_dir.mkdir(parents=True, exist_ok=True)
        self._recipes: Dict[str, Recipe] = {}
        self._load_recipes()

    def _load_recipes(self) -> None:
        """Load all recipes from disk."""
        self._recipes = {}
        for recipe_file in self.recipes_dir.glob("*.json"):
            try:
                with open(recipe_file) as f:
                    data = json.load(f)
                    recipe = Recipe(**data)
                    self._recipes[recipe.id] = recipe
            except Exception as e:
                print(f"Error loading recipe {recipe_file}: {e}")

    def save_recipe(self, recipe: Recipe) -> None:
        """Save a recipe to disk."""
        recipe_file = self.recipes_dir / f"{recipe.id}.json"
        with open(recipe_file, 'w') as f:
            json.dump(recipe.model_dump(), f, indent=2)
        self._recipes[recipe.id] = recipe

    def get_recipe(self, recipe_id: str) -> Optional[Recipe]:
        """Get a recipe by ID."""
        return self._recipes.get(recipe_id)

    def list_recipes(self) -> List[Recipe]:
        """List all recipes."""
        return list(self._recipes.values())

    def delete_recipe(self, recipe_id: str) -> bool:
        """Delete a recipe."""
        if recipe_id not in self._recipes:
            return False

        recipe_file = self.recipes_dir / f"{recipe_id}.json"
        if recipe_file.exists():
            recipe_file.unlink()

        del self._recipes[recipe_id]
        return True

    def get_recipes_with_status(self, port: int = 8000) -> List[RecipeWithStatus]:
        """Get all recipes with their current status."""
        current_process = ProcessManager.get_current_process(port)
        current_model = current_process.model_path if current_process else None

        results = []
        for recipe in self._recipes.values():
            status = RecipeStatus.STOPPED
            pid = None

            if current_model and recipe.model_path == current_model:
                status = RecipeStatus.RUNNING
                pid = current_process.pid

            results.append(RecipeWithStatus(
                **recipe.model_dump(),
                status=status,
                pid=pid
            ))

        return results

    def find_recipe_for_model(self, model_path: str) -> Optional[Recipe]:
        """Find a recipe that matches the given model path."""
        for recipe in self._recipes.values():
            if recipe.model_path == model_path:
                return recipe
        return None

    def get_running_recipe(self, port: int = 8000) -> Optional[RecipeWithStatus]:
        """Get the currently running recipe if any."""
        current_process = ProcessManager.get_current_process(port)
        if not current_process:
            return None

        recipe = self.find_recipe_for_model(current_process.model_path)
        if recipe:
            return RecipeWithStatus(
                **recipe.model_dump(),
                status=RecipeStatus.RUNNING,
                pid=current_process.pid
            )

        # Create a temporary recipe from the running process
        return RecipeWithStatus(
            id="unknown",
            name="Unknown Model",
            model_path=current_process.model_path,
            backend=current_process.backend,
            status=RecipeStatus.RUNNING,
            pid=current_process.pid
        )
