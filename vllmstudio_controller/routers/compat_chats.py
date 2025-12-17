from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from vllmstudio.chat_store import ChatStore

from ..config import Settings
from ..deps import get_settings, require_scope


router = APIRouter(tags=["compat"])


def _store(cfg: Settings) -> ChatStore:
    return ChatStore(cfg.chats_db_path)


@router.get("/chats")
async def list_chats(
    limit: int = 50,
    _p=Depends(require_scope("chats:read")),
    cfg: Settings = Depends(get_settings),
):
    return _store(cfg).list_sessions(limit=limit)


@router.post("/chats")
async def create_chat(
    title: str = "New Chat",
    model: Optional[str] = None,
    _p=Depends(require_scope("chats:write")),
    cfg: Settings = Depends(get_settings),
):
    return _store(cfg).create_session(title=title, model=model)


@router.get("/chats/{session_id}")
async def get_chat(
    session_id: str,
    _p=Depends(require_scope("chats:read")),
    cfg: Settings = Depends(get_settings),
):
    session = _store(cfg).get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@router.put("/chats/{session_id}")
async def update_chat(
    session_id: str,
    title: Optional[str] = None,
    model: Optional[str] = None,
    _p=Depends(require_scope("chats:write")),
    cfg: Settings = Depends(get_settings),
):
    ok = _store(cfg).update_session(session_id, title=title, model=model)
    if not ok:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"status": "updated"}


@router.delete("/chats/{session_id}")
async def delete_chat(
    session_id: str,
    _p=Depends(require_scope("chats:write")),
    cfg: Settings = Depends(get_settings),
):
    ok = _store(cfg).delete_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"status": "deleted"}


@router.post("/chats/{session_id}/messages")
async def add_message(
    session_id: str,
    payload: Dict[str, Any],
    _p=Depends(require_scope("chats:write")),
    cfg: Settings = Depends(get_settings),
):
    role = str(payload.get("role") or "")
    content = str(payload.get("content") or "")
    if not role or not content:
        raise HTTPException(status_code=400, detail="role and content required")

    return _store(cfg).add_message(
        session_id=session_id,
        role=role,
        content=content,
        model=payload.get("model"),
        tool_calls=payload.get("tool_calls"),
        message_id=payload.get("id"),
        request_prompt_tokens=payload.get("request_prompt_tokens"),
        request_tools_tokens=payload.get("request_tools_tokens"),
        request_total_input_tokens=payload.get("request_total_input_tokens"),
        request_completion_tokens=payload.get("request_completion_tokens"),
        estimated_cost_usd=payload.get("estimated_cost_usd"),
    )


@router.post("/chats/{session_id}/fork")
async def fork_chat(
    session_id: str,
    payload: Dict[str, Any],
    _p=Depends(require_scope("chats:write")),
    cfg: Settings = Depends(get_settings),
):
    fork = _store(cfg).fork_session(
        session_id,
        title=payload.get("title"),
        model=payload.get("model"),
        message_id=payload.get("message_id"),
    )
    if not fork:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return fork


@router.get("/chats/{session_id}/usage")
async def chat_usage(
    session_id: str,
    _p=Depends(require_scope("chats:read")),
    cfg: Settings = Depends(get_settings),
):
    usage = _store(cfg).get_session_usage(session_id)
    if not usage:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return usage

