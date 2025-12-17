from __future__ import annotations

import json
import time
import uuid
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from fastapi.responses import StreamingResponse

from vllmstudio.token_counter import TokenUsage, usage_tracker

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
    # All OpenAI traffic goes through the local proxy so model-family adapters
    # (MiniMax/GLM/Devstral/etc) are applied consistently.
    proxy_base = getattr(request.app.state, "proxy_base", None) or f"http://{cfg.proxy_host}:{cfg.proxy_port}"
    target_url = f"{proxy_base}/v1/{path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "content-length"}}

    body = b""
    if method != "GET":
        body = await request.body()

    request_id = f"req-{uuid.uuid4().hex[:12]}"
    start = time.perf_counter()
    completion_usage: Optional[Dict[str, Any]] = None
    response_model: Optional[str] = None

    # Minimal auto-switch: if client requests model == recipe.id/served_model_name, ensure it is running.
    if method != "GET" and path in {"chat/completions", "completions"} and body:
        try:
            payload = json.loads(body)
            model = payload.get("model")
            response_model = model if isinstance(model, str) else None
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
                        response_model = payload["model"]
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
            nonlocal completion_usage, response_model
            try:
                async for chunk in resp.aiter_raw():
                    # Best-effort: capture usage from the final SSE chunk if present.
                    if path in {"chat/completions", "completions"}:
                        try:
                            s = chunk.decode("utf-8", errors="ignore")
                            for line in s.splitlines():
                                if not line.startswith("data: "):
                                    continue
                                data_str = line[6:].strip()
                                if not data_str or data_str == "[DONE]":
                                    continue
                                obj = json.loads(data_str)
                                if isinstance(obj, dict):
                                    if obj.get("model") and not response_model:
                                        response_model = str(obj.get("model"))
                                    if "usage" in obj and isinstance(obj["usage"], dict):
                                        completion_usage = obj["usage"]
                        except Exception:
                            pass
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()
                if completion_usage:
                    latency_ms = (time.perf_counter() - start) * 1000.0
                    usage = TokenUsage(
                        prompt_tokens=int(completion_usage.get("prompt_tokens") or 0),
                        completion_tokens=int(completion_usage.get("completion_tokens") or 0),
                        total_tokens=int(completion_usage.get("total_tokens") or 0),
                    )
                    usage_tracker.log_usage(
                        request_id=request_id,
                        model=response_model or "unknown",
                        usage=usage,
                        latency_ms=latency_ms,
                        endpoint=f"/v1/{path}",
                    )

        return StreamingResponse(_stream(), status_code=resp.status_code, media_type=content_type)

    data = await resp.aread()
    await resp.aclose()
    await client.aclose()

    if path in {"chat/completions", "completions"} and resp.status_code == 200:
        try:
            obj = json.loads(data)
            if isinstance(obj, dict):
                response_model = response_model or (str(obj.get("model")) if obj.get("model") else None)
                u = obj.get("usage") if isinstance(obj.get("usage"), dict) else None
                if u:
                    latency_ms = (time.perf_counter() - start) * 1000.0
                    usage = TokenUsage(
                        prompt_tokens=int(u.get("prompt_tokens") or 0),
                        completion_tokens=int(u.get("completion_tokens") or 0),
                        total_tokens=int(u.get("total_tokens") or 0),
                    )
                    usage_tracker.log_usage(
                        request_id=request_id,
                        model=response_model or "unknown",
                        usage=usage,
                        latency_ms=latency_ms,
                        endpoint=f"/v1/{path}",
                    )
        except Exception:
            pass

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
