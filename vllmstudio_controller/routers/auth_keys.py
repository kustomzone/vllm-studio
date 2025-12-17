from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import create_api_key, generate_token, list_api_keys, revoke_api_key
from ..deps import get_db, require_admin
from ..db import SQLiteDB


router = APIRouter(prefix="/auth/keys", tags=["auth"])


class CreateKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    scopes: List[str] = Field(default_factory=list)


class CreateKeyResponse(BaseModel):
    id: int
    name: str
    scopes: List[str]
    token: str


@router.get("")
async def list_keys(_admin=Depends(require_admin), db: SQLiteDB = Depends(get_db)):
    return {"keys": list_api_keys(db)}


@router.post("", response_model=CreateKeyResponse)
async def create_key(req: CreateKeyRequest, _admin=Depends(require_admin), db: SQLiteDB = Depends(get_db)):
    token = generate_token()
    scopes = req.scopes or ["inference:read", "inference:write", "recipes:read"]
    key_id = create_api_key(db, name=req.name, token=token, scopes=scopes)
    return CreateKeyResponse(id=key_id, name=req.name, scopes=scopes, token=token)


@router.delete("/{key_id}")
async def delete_key(key_id: int, _admin=Depends(require_admin), db: SQLiteDB = Depends(get_db)):
    if not revoke_api_key(db, key_id):
        raise HTTPException(status_code=404, detail="Key not found or already revoked")
    return {"status": "revoked", "id": key_id}
