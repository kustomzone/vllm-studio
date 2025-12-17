"""Message normalization and tool-call extraction pipelines.

This module centralizes all model-family specific normalization so proxy/API code
doesn't need to branch on families inline.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Literal

from .reasoning import ensure_think_wrapped
from .minimax.tools import parse_tool_calls, tool_calls_to_minimax_xml
from .glm.tools import parse_glm_tool_calls, tool_calls_to_glm_xml
from .mistral.tools import parse_mistral_tool_calls, tool_calls_to_mistral_format

ModelFamily = Literal["minimax", "glm", "mistral", "default"]


def _reasoning_details_to_text(reasoning_details: Any) -> str:
    if not isinstance(reasoning_details, list):
        return ""
    out = ""
    for detail in reasoning_details:
        if isinstance(detail, dict):
            out += str(detail.get("text", ""))
    return out


def _normalize_minimax_tool_result(message: Dict[str, Any]) -> Dict[str, Any]:
    """MiniMax-M2 chat templates commonly reject role='tool'; normalize to user messages.

    We keep a lightweight marker (`name="tool_result"`) so downstream repair logic can
    still identify tool result boundaries.
    """
    tool_call_id = message.get("tool_call_id") or message.get("tool_use_id") or ""
    tool_name = message.get("name") or message.get("tool_name") or ""
    raw_content = message.get("content")

    if raw_content is None:
        content_str = ""
    elif isinstance(raw_content, str):
        content_str = raw_content
    else:
        try:
            content_str = json.dumps(raw_content, ensure_ascii=False)
        except (TypeError, ValueError):
            content_str = str(raw_content)

    label = tool_call_id or tool_name or "unknown"
    return {
        "role": "user",
        "name": "tool_result",
        "content": f"Tool result for {label}: {content_str}",
    }


def _parse_tool_calls_from_content(
    content: str,
    *,
    family: ModelFamily,
    tools: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    if family == "glm":
        return parse_glm_tool_calls(content, tools)
    if family == "mistral":
        return parse_mistral_tool_calls(content, tools)
    if family == "minimax":
        return parse_tool_calls(content, tools)
    return {"tools_called": False, "tool_calls": [], "content": content}


def _render_tool_calls_inline(
    tool_calls: Optional[List[Dict[str, Any]]],
    *,
    family: ModelFamily,
) -> Optional[str]:
    if family == "glm":
        return tool_calls_to_glm_xml(tool_calls)
    if family == "mistral":
        return tool_calls_to_mistral_format(tool_calls)
    if family == "minimax":
        return tool_calls_to_minimax_xml(tool_calls)
    return None


def normalize_history_for_backend(
    messages: List[Dict[str, Any]],
    *,
    family: ModelFamily,
    tools: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Normalize assistant messages so the backend receives inline thinking/tool blocks.

    - Converts `reasoning_details` into `<think>...</think>` blocks (when present).
    - Ensures existing `</think>` content is wrapped with `<think>` opening tags.
    - If assistant `tool_calls` are present, appends inline tool-call format.
    - If inline tool-call format exists but `tool_calls` field is missing, extracts it.
    """
    normalized: List[Dict[str, Any]] = []
    for message in messages:
        msg_copy = dict(message)
        role = msg_copy.get("role")

        if family == "minimax" and role == "tool":
            normalized.append(_normalize_minimax_tool_result(msg_copy))
            continue

        if role != "assistant":
            normalized.append(msg_copy)
            continue

        reasoning_text = _reasoning_details_to_text(msg_copy.pop("reasoning_details", None))
        content = msg_copy.get("content") or ""

        # If tool_calls missing but content contains inline tool blocks, extract.
        tool_calls = msg_copy.get("tool_calls")
        if not tool_calls:
            parsed = _parse_tool_calls_from_content(content, family=family, tools=tools)
            if parsed.get("tools_called"):
                msg_copy["tool_calls"] = parsed.get("tool_calls", [])
                tool_calls = msg_copy["tool_calls"]
                new_content = parsed.get("content")
                msg_copy["content"] = new_content if new_content is not None else ""
                content = msg_copy["content"]

        if reasoning_text:
            reason_block = f"<think>{reasoning_text}</think>"
            if content and not str(content).startswith("\n"):
                reason_block = f"{reason_block}\n"
            msg_copy["content"] = reason_block + str(content)
        elif content and "</think>" in str(content):
            msg_copy["content"] = ensure_think_wrapped(str(content))

        tool_calls = msg_copy.get("tool_calls")
        if tool_calls:
            inline = _render_tool_calls_inline(tool_calls, family=family)
            if inline:
                updated = msg_copy.get("content") or ""
                if "</think>" in updated and "<think>" not in updated:
                    updated = ensure_think_wrapped(updated)
                if inline not in updated:
                    stripped = updated.rstrip()
                    msg_copy["content"] = f"{stripped}\n\n{inline}" if stripped else inline
                else:
                    msg_copy["content"] = updated

        normalized.append(msg_copy)
    return normalized
