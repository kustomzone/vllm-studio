from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from vllmstudio.models import Recipe

from ..deps import get_store, require_scope
from ..stores import SQLiteRecipeStore


router = APIRouter(tags=["compat"])


@router.get("/recipes/export-all")
async def export_all_recipes(
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    recipes = [r.model_dump() for r in store.list()]
    return {"format": "json", "content": {"recipes": recipes}, "count": len(recipes)}


@router.post("/recipes/import")
async def import_recipes(
    payload: Dict[str, Any],
    _p=Depends(require_scope("recipes:write")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    content = payload.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="content required")

    imported: List[Recipe] = []
    if isinstance(content, dict) and isinstance(content.get("recipes"), list):
        items = content.get("recipes") or []
        for item in items:
            imported.append(Recipe(**item))
    elif isinstance(content, dict):
        imported.append(Recipe(**content))
    else:
        raise HTTPException(status_code=400, detail="Invalid content payload")

    for recipe in imported:
        store.upsert(recipe)

    return {"success": True, "count": len(imported), "recipe_ids": [r.id for r in imported]}

