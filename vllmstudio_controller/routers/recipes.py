from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from vllmstudio.backends import get_backend
from vllmstudio.models import Recipe
from vllmstudio.models_launch_plan import LaunchPlan

from ..deps import get_store, require_scope
from ..stores import SQLiteRecipeStore


router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("")
async def list_recipes(_p=Depends(require_scope("recipes:read")), store: SQLiteRecipeStore = Depends(get_store)):
    return store.list()


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: str,
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    recipe = store.get(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("")
async def create_recipe(recipe: Recipe, _p=Depends(require_scope("recipes:write")), store: SQLiteRecipeStore = Depends(get_store)):
    if store.get(recipe.id):
        raise HTTPException(status_code=409, detail="Recipe already exists")
    return store.upsert(recipe)


@router.put("/{recipe_id}")
async def update_recipe(recipe_id: str, recipe: Recipe, _p=Depends(require_scope("recipes:write")), store: SQLiteRecipeStore = Depends(get_store)):
    recipe = recipe.model_copy(update={"id": recipe_id})
    return store.upsert(recipe)


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: str, _p=Depends(require_scope("recipes:write")), store: SQLiteRecipeStore = Depends(get_store)):
    if not store.delete(recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"status": "deleted"}


@router.get("/{recipe_id}/plan", response_model=LaunchPlan)
async def launch_plan(recipe_id: str, _p=Depends(require_scope("recipes:read")), store: SQLiteRecipeStore = Depends(get_store)):
    recipe = store.get(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    backend = get_backend(recipe.backend)
    return LaunchPlan(
        recipe=recipe,
        backend=recipe.backend,
        command=backend.build_launch_command(recipe),
        env=backend.build_launch_env(recipe),
        log_file=str(backend.default_log_file(recipe.id)),
    )
