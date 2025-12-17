from __future__ import annotations

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
    items = store.list_model_keys()
    return {
        "data": [
            ModelEntry(id=i["model_key"], default_recipe_id=i["default_recipe_id"], recipe_ids=i["recipe_ids"])
            for i in items
        ]
    }
