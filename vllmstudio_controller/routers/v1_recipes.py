from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from vllmstudio.models import Recipe

from ..deps import get_store, require_scope
from ..stores import RecipeRecord, SQLiteRecipeStore


router = APIRouter(prefix="/v1", tags=["recipes"])


class RecipeRecordResponse(BaseModel):
    model_key: str
    is_default: bool
    recipe: Recipe

    @classmethod
    def from_record(cls, record: RecipeRecord) -> "RecipeRecordResponse":
        return cls(model_key=record.model_key, is_default=record.is_default, recipe=record.recipe)


class RecipeUpsertRequest(BaseModel):
    model_key: str = Field(..., min_length=1, max_length=200)
    is_default: bool = False
    recipe: Recipe


@router.get("/recipes", response_model=List[RecipeRecordResponse])
async def list_recipes_v1(
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    return [RecipeRecordResponse.from_record(r) for r in store.list_records()]


@router.get("/recipes/{recipe_id}", response_model=RecipeRecordResponse)
async def get_recipe_v1(
    recipe_id: str,
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    record = store.get_record(recipe_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeRecordResponse.from_record(record)


@router.post("/recipes", response_model=RecipeRecordResponse)
async def create_recipe_v1(
    req: RecipeUpsertRequest,
    _p=Depends(require_scope("recipes:write")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    if store.get(req.recipe.id):
        raise HTTPException(status_code=409, detail="Recipe already exists")
    store.upsert(req.recipe, model_key=req.model_key, is_default=req.is_default)
    record = store.get_record(req.recipe.id)
    if not record:
        raise HTTPException(status_code=500, detail="Failed to persist recipe")
    return RecipeRecordResponse.from_record(record)


@router.put("/recipes/{recipe_id}", response_model=RecipeRecordResponse)
async def update_recipe_v1(
    recipe_id: str,
    req: RecipeUpsertRequest,
    _p=Depends(require_scope("recipes:write")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    recipe = req.recipe.model_copy(update={"id": recipe_id})
    store.upsert(recipe, model_key=req.model_key, is_default=req.is_default)
    record = store.get_record(recipe_id)
    if not record:
        raise HTTPException(status_code=500, detail="Failed to persist recipe")
    return RecipeRecordResponse.from_record(record)


@router.post("/recipes/{recipe_id}/default", response_model=RecipeRecordResponse)
async def set_default_recipe_v1(
    recipe_id: str,
    _p=Depends(require_scope("recipes:write")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    record = store.set_default(recipe_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return RecipeRecordResponse.from_record(record)
