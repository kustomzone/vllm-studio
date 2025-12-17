from __future__ import annotations

import time
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..deps import get_store, require_scope
from ..stores import SQLiteRecipeStore


router = APIRouter(prefix="/v1", tags=["models"])


class ModelEntry(BaseModel):
    id: str = Field(..., description="Stable model alias used by clients (a.k.a. model_key).")
    default_recipe_id: Optional[str] = Field(default=None)
    recipe_ids: List[str] = Field(default_factory=list)


@router.get("/models")
async def list_models(
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    # OpenAI-compatible listing of model aliases ("model_key"), each mapped to its default recipe.
    items = store.list_model_keys()
    data = []
    now = int(time.time())
    for item in items:
        model_key = item["model_key"]
        default_id = item.get("default_recipe_id")
        record = store.get_record(default_id) if default_id else None
        recipe = record.recipe if record else None
        data.append(
            {
                "id": model_key,
                "object": "model",
                "created": now,
                "owned_by": "vllm-studio",
                "root": recipe.model_path if recipe else None,
                "parent": None,
                "max_model_len": recipe.max_model_len if recipe else None,
            }
        )
    return {"object": "list", "data": data}


@router.get("/studio/models")
async def list_studio_models(
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    items = store.list_model_keys()
    return {"data": [ModelEntry(id=i["model_key"], default_recipe_id=i["default_recipe_id"], recipe_ids=i["recipe_ids"]) for i in items]}
