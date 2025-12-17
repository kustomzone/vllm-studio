"""FastAPI dependencies for the minimal controller (read from app.state)."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from .auth import Principal
from .db import SQLiteDB

from .config import Settings
from .services import Launcher
from .stores import SQLiteRecipeStore


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> SQLiteDB:
    return request.app.state.db


def get_store(request: Request) -> SQLiteRecipeStore:
    return request.app.state.store


def get_launcher(request: Request) -> Launcher:
    return request.app.state.launcher


def get_proxy_base(request: Request) -> str:
    return request.app.state.proxy_base


def get_inference_port(request: Request) -> int:
    return request.app.state.settings.inference_port


def require_principal(request: Request) -> Principal:
    principal = getattr(request.state, "principal", None)
    if principal is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return principal


def require_admin(principal: Principal = Depends(require_principal)) -> Principal:
    if not principal.is_admin:
        raise HTTPException(status_code=403, detail="Admin required")
    return principal


def require_scope(scope: str):
    def _dep(principal: Principal = Depends(require_principal)) -> Principal:
        if not principal.has(scope):
            raise HTTPException(status_code=403, detail=f"Missing scope: {scope}")
        return principal

    return _dep
