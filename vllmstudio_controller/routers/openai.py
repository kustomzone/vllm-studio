from __future__ import annotations

import json
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse

from ..deps import get_launcher, get_settings, get_store, require_scope
from ..services import Launcher
from ..stores import SQLiteRecipeStore
from ..config import Settings


router = APIRouter(tags=["openai"])


def _find_recipe_for_model(store: SQLiteRecipeStore, model: Optional[str]):
    if not model:
        return None
    by_id = store.get_record(model)
    if by_id:
        return by_id
    by_alias = store.get_default_for_model_key(model)
    if by_alias:
        return by_alias
    for record in store.list_records():
        if record.recipe.served_model_name and record.recipe.served_model_name == model:
            return record
    return None


async def _passthrough(
    *,
    method: str,
    path: str,
    request: Request,
    cfg: Settings,
    store: SQLiteRecipeStore,
    launcher: Launcher,
):
    target_url = f"http://{cfg.inference_host}:{cfg.inference_port}/v1/{path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}

    body = b""
    if method != "GET":
        body = await request.body()

    # Minimal auto-switch: if client requests model == recipe.id/served_model_name, ensure it is running.
    if method != "GET" and path in {"chat/completions", "completions"} and body:
        try:
            payload = json.loads(body)
            model = payload.get("model")
            record = _find_recipe_for_model(store, model if isinstance(model, str) else None)
            if record:
                recipe = record.recipe
                current = getattr(request.app.state, "current_recipe_id", None)
                if current != recipe.id:
                    # Ensure vLLM has a stable served model name that clients can address.
                    if recipe.backend.value == "vllm" and not recipe.served_model_name:
                        recipe = recipe.model_copy(update={"served_model_name": recipe.id})
                        store.upsert(recipe, model_key=record.model_key, is_default=record.is_default)

                    lock = getattr(request.app.state, "switch_lock", None)
                    if lock is None:
                        ok, _pid, _detail = await launcher.switch(recipe, force=False)
                    else:
                        async with lock:
                            ok, _pid, _detail = await launcher.switch(recipe, force=False)
                    if ok:
                        request.app.state.current_recipe_id = recipe.id
                        payload["model"] = recipe.served_model_name or recipe.id
                        body = json.dumps(payload).encode("utf-8")
        except Exception:
            pass

    client = httpx.AsyncClient(timeout=None)
    req = client.build_request(method, target_url, content=body or None, headers=headers)
    try:
        resp = await client.send(req, stream=True)
    except httpx.HTTPError as e:
        await client.aclose()
        return JSONResponse(status_code=502, content={"error": {"message": f"Upstream inference error: {e.__class__.__name__}"}})

    content_type = resp.headers.get("content-type", "application/octet-stream")
    if "text/event-stream" in content_type and resp.status_code < 400:
        async def _stream():
            try:
                async for chunk in resp.aiter_raw():
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(_stream(), status_code=resp.status_code, media_type=content_type)

    data = await resp.aread()
    await resp.aclose()
    await client.aclose()
    return Response(content=data, status_code=resp.status_code, media_type=content_type)


@router.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    _p=Depends(require_scope("inference:write")),
    cfg: Settings = Depends(get_settings),
    store: SQLiteRecipeStore = Depends(get_store),
    launcher: Launcher = Depends(get_launcher),
):
    return await _passthrough(
        method="POST",
        path="chat/completions",
        request=request,
        cfg=cfg,
        store=store,
        launcher=launcher,
    )


@router.post("/v1/completions")
async def completions(
    request: Request,
    _p=Depends(require_scope("inference:write")),
    cfg: Settings = Depends(get_settings),
    store: SQLiteRecipeStore = Depends(get_store),
    launcher: Launcher = Depends(get_launcher),
):
    return await _passthrough(method="POST", path="completions", request=request, cfg=cfg, store=store, launcher=launcher)


@router.post("/v1/embeddings")
async def embeddings(
    request: Request,
    _p=Depends(require_scope("inference:write")),
    cfg: Settings = Depends(get_settings),
    store: SQLiteRecipeStore = Depends(get_store),
    launcher: Launcher = Depends(get_launcher),
):
    return await _passthrough(method="POST", path="embeddings", request=request, cfg=cfg, store=store, launcher=launcher)
