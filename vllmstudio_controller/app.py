from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from starlette.middleware.base import BaseHTTPMiddleware

from .auth import Principal, authenticate
from .config import Settings, settings as default_settings
from .db import SQLiteDB
from .routers import (
    auth_keys_router,
    compat_chats_router,
    compat_gpus_metrics_router,
    compat_logs_router,
    compat_mcp_router,
    compat_models_browser_router,
    compat_recipes_io_router,
    compat_skills_router,
    compat_tokens_usage_router,
    compat_vram_router,
    openai_router,
    ops_router,
    passthrough_router,
    recipes_router,
    runs_router,
    system_router,
    v1_models_router,
    v1_recipes_router,
)
from .services import Launcher
from .stores import SQLiteRecipeStore


class APIKeyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, *, api_key: Optional[str], admin_key: Optional[str], db: SQLiteDB):
        super().__init__(app)
        self.api_key = api_key
        self.admin_key = admin_key
        self.db = db

    async def dispatch(self, request: Request, call_next):
        # If no auth configured, allow all.
        if not self.api_key and not self.admin_key:
            request.state.principal = Principal(token_id=None, name="anonymous", scopes=set(), is_admin=True)
            return await call_next(request)

        if request.url.path in {"/health", "/docs", "/openapi.json", "/redoc"}:
            return await call_next(request)

        token = None
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()

        if not token:
            return JSONResponse(status_code=401, content={"error": {"message": "Missing bearer token"}})

        # Admin token
        if self.admin_key and token == self.admin_key:
            request.state.principal = Principal(token_id=None, name="admin", scopes=set(), is_admin=True)
            return await call_next(request)

        # Legacy single API key (treat as admin for backwards compatibility).
        if self.api_key and token == self.api_key:
            request.state.principal = Principal(token_id=None, name="legacy", scopes=set(), is_admin=True)
            return await call_next(request)

        principal = authenticate(self.db, token)
        if principal:
            request.state.principal = principal
            return await call_next(request)

        return JSONResponse(status_code=401, content={"error": {"message": "Invalid API key"}})


def _generate_unique_id(route: APIRoute) -> str:
    methods = sorted(m for m in route.methods or set() if m not in {"HEAD", "OPTIONS"})
    method = methods[0].lower() if methods else "any"
    path = route.path_format.strip("/").replace("/", "_").replace("{", "").replace("}", "")
    return f"{route.name}_{method}_{path}"


def create_app(cfg: Settings = default_settings) -> FastAPI:
    db = SQLiteDB(cfg.sqlite_path)
    db.migrate()

    app = FastAPI(
        title="vLLM Studio Controller",
        version="0.1.0",
        description="Minimal control-plane API for managing vLLM/SGLang inference servers.",
        generate_unique_id_function=_generate_unique_id,
    )

    app.state.settings = cfg
    app.state.db = db
    app.state.store = SQLiteRecipeStore(db)
    app.state.launcher = Launcher(inference_port=cfg.inference_port)
    app.state.proxy_base = f"http://{cfg.proxy_host}:{cfg.proxy_port}"
    app.state.switch_lock = asyncio.Lock()

    app.add_middleware(APIKeyMiddleware, api_key=cfg.api_key, admin_key=cfg.admin_key, db=db)

    app.include_router(system_router)
    app.include_router(auth_keys_router)
    app.include_router(recipes_router)
    # Legacy/compat endpoints used by the existing UI.
    app.include_router(compat_gpus_metrics_router)
    app.include_router(compat_models_browser_router)
    app.include_router(compat_vram_router)
    app.include_router(compat_logs_router)
    app.include_router(compat_recipes_io_router)
    app.include_router(compat_tokens_usage_router)
    app.include_router(compat_chats_router)
    app.include_router(compat_mcp_router)
    app.include_router(compat_skills_router)
    # "Management" /v1 endpoints must be registered before the /v1/{path:path} passthrough router.
    app.include_router(v1_models_router)
    app.include_router(v1_recipes_router)
    app.include_router(ops_router)
    app.include_router(runs_router)
    if cfg.enable_openai_passthrough:
        app.include_router(openai_router)
    if cfg.enable_anthropic_passthrough:
        app.include_router(passthrough_router)

    return app
