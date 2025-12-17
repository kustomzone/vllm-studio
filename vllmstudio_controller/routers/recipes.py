from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from vllmstudio.backends import get_backend
from vllmstudio.models import Recipe, RecipeStatus, RecipeWithStatus
from vllmstudio.models_launch_plan import LaunchPlan

from ..deps import get_inference_port, get_store, require_scope
from ..stores import SQLiteRecipeStore
from ..services import find_current_inference_process


router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("")
async def list_recipes(
    request: Request,
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
    inference_port: int = Depends(get_inference_port),
):
    current_process = find_current_inference_process(inference_port)
    out: list[RecipeWithStatus] = []
    for recipe in store.list():
        status = RecipeStatus.STOPPED
        pid = None
        if current_process:
            status = RecipeStatus.RUNNING
            pid = current_process.pid
            # Only mark as running if we can match by served name or model path.
            if current_process.served_model_name and recipe.served_model_name:
                if current_process.served_model_name != recipe.served_model_name:
                    status = RecipeStatus.STOPPED
                    pid = None
            elif current_process.model_path and current_process.model_path != recipe.model_path:
                status = RecipeStatus.STOPPED
                pid = None
        out.append(RecipeWithStatus(**recipe.model_dump(), status=status, pid=pid))
    return out


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: str,
    request: Request,
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
    inference_port: int = Depends(get_inference_port),
):
    recipe = store.get(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    current_recipe_id = getattr(request.app.state, "current_recipe_id", None)
    current_process = find_current_inference_process(inference_port)
    status = RecipeStatus.STOPPED
    pid = None
    if current_process:
        if current_process.served_model_name and recipe.served_model_name:
            if current_process.served_model_name == recipe.served_model_name:
                status = RecipeStatus.RUNNING
                pid = current_process.pid
        elif current_process.model_path and current_process.model_path == recipe.model_path:
            status = RecipeStatus.RUNNING
            pid = current_process.pid
        elif current_recipe_id and recipe.id == current_recipe_id:
            # Selected but not currently running (failed/crashed).
            status = RecipeStatus.STOPPED
    return RecipeWithStatus(**recipe.model_dump(), status=status, pid=pid)


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
