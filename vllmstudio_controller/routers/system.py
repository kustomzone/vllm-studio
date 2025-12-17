from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, Request

from vllmstudio import __version__

from ..deps import get_inference_port, get_settings, get_store, require_scope
from ..stores import SQLiteRecipeStore
from ..services import find_current_inference_process
from ..config import Settings


router = APIRouter(tags=["system"])


@router.get("/health")
async def health(
    request: Request,
    cfg: Settings = Depends(get_settings),
    store: SQLiteRecipeStore = Depends(get_store),
):
    current = find_current_inference_process(cfg.inference_port)
    running_model = current.model_path if current and current.model_path else None

    backend_reachable = False
    proxy_reachable = False
    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            resp = await client.get(f"http://{cfg.inference_host}:{cfg.inference_port}/health")
            backend_reachable = resp.status_code == 200
        except Exception:
            backend_reachable = False

        try:
            resp = await client.get(f"http://{cfg.proxy_host}:{cfg.proxy_port}/health")
            proxy_reachable = resp.status_code == 200
        except Exception:
            proxy_reachable = False

    # Only attribute a "running model" if we have an actual inference process.
    # (Some launches can fail after the controller marks a recipe as selected.)
    if not current:
        running_model = None

    return {
        "status": "ok",
        "version": __version__,
        "running_model": running_model,
        "backend_reachable": backend_reachable,
        "proxy_reachable": proxy_reachable,
    }


@router.get("/status")
async def status(
    request: Request,
    _p=Depends(require_scope("inference:read")),
    inference_port: int = Depends(get_inference_port),
    cfg: Settings = Depends(get_settings),
    store: SQLiteRecipeStore = Depends(get_store),
):
    current = find_current_inference_process(inference_port)
    matched_recipe = None

    # Derive matched recipe from the actual running process (not last selected id).
    if current:
        records = store.list_records()
        if current.served_model_name:
            for record in records:
                recipe = record.recipe
                if recipe.served_model_name and current.served_model_name == recipe.served_model_name:
                    matched_recipe = recipe
                    break
        if not matched_recipe and current.model_path:
            for record in records:
                recipe = record.recipe
                if recipe.model_path == current.model_path:
                    matched_recipe = recipe
                    break

    running_process = current.__dict__ if current else None
    if running_process and matched_recipe:
        if not running_process.get("model_path"):
            running_process["model_path"] = matched_recipe.model_path
        if not running_process.get("backend"):
            running_process["backend"] = matched_recipe.backend.value
        if not running_process.get("served_model_name") and matched_recipe.served_model_name:
            running_process["served_model_name"] = matched_recipe.served_model_name

    return {
        "running_process": running_process,
        "matched_recipe": matched_recipe.model_dump() if matched_recipe else None,
        "vllm_port": cfg.inference_port,
        "proxy_port": cfg.proxy_port,
        "recipes_count": len(store.list()),
    }
