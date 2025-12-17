from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from vllmstudio.models import TokenCountRequest, TokenCountResponse
from vllmstudio.token_counter import TokenCounter, usage_tracker

from ..deps import require_scope


router = APIRouter(tags=["compat"])


@router.post("/v1/tokens/count", response_model=TokenCountResponse)
async def tokens_count(req: TokenCountRequest, _p=Depends(require_scope("inference:read"))):
    if req.text is not None:
        tokens = TokenCounter.count_tokens(req.text, req.model)
        return TokenCountResponse(num_tokens=tokens)

    messages = req.messages or []
    tools = req.tools or []
    msg_tokens = TokenCounter.count_message_tokens(messages, req.model)
    tool_tokens = TokenCounter.count_tools_tokens(tools, req.model) if tools else 0
    return TokenCountResponse(num_tokens=msg_tokens + tool_tokens, breakdown={"messages": msg_tokens, "tools": tool_tokens})


@router.post("/v1/chat/completions/tokenize")
async def chat_tokenize(payload: Dict[str, Any], _p=Depends(require_scope("inference:read"))):
    model = str(payload.get("model") or "default")
    messages = payload.get("messages") or []
    tools = payload.get("tools") or None
    msg_tokens = TokenCounter.count_message_tokens(messages, model)
    tool_tokens = TokenCounter.count_tools_tokens(tools, model) if tools else 0
    return {"input_tokens": msg_tokens + tool_tokens, "breakdown": {"messages": msg_tokens, "tools": tool_tokens or None}}


@router.get("/v1/usage")
async def usage(window_seconds: Optional[int] = None, _p=Depends(require_scope("inference:read"))):
    return usage_tracker.get_stats(window_seconds)


@router.get("/v1/usage/recent")
async def usage_recent(limit: int = 100, _p=Depends(require_scope("inference:read"))):
    entries = usage_tracker.get_recent(limit)
    return {"entries": entries, "count": len(entries)}


@router.delete("/v1/usage")
async def usage_clear(_p=Depends(require_scope("inference:write"))):
    usage_tracker.clear()
    return {"status": "cleared"}

