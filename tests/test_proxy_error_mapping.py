from __future__ import annotations

import asyncio

from proxy.client import BackendError
from proxy.models import AnthropicChatRequest, OpenAIChatRequest


def _make_request():
    from starlette.requests import Request

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("127.0.0.1", 8001),
    }
    req = Request(scope, receive)
    req.state.request_id = "req_test"
    return req


def test_openai_backend_error_maps_to_502(monkeypatch):
    import proxy.main as proxy_main

    async def fail(*_args, **_kwargs):
        raise BackendError(status_code=500, body="boom")

    monkeypatch.setattr(proxy_main, "complete_openai_response", fail)

    raw_request = _make_request()
    chat_request = OpenAIChatRequest(model="minimax-m2", messages=[{"role": "user", "content": "hi"}])
    response = asyncio.run(proxy_main.openai_chat_completions(chat_request, raw_request))

    assert getattr(response, "status_code", None) == 502


def test_anthropic_backend_error_maps_to_502(monkeypatch):
    import proxy.main as proxy_main

    async def fail(*_args, **_kwargs):
        raise BackendError(status_code=500, body="boom")

    monkeypatch.setattr(proxy_main, "complete_anthropic_response", fail)

    raw_request = _make_request()
    chat_request = AnthropicChatRequest(model="minimax-m2", messages=[{"role": "user", "content": "hi"}])
    response = asyncio.run(proxy_main.anthropic_messages(chat_request, raw_request))

    assert getattr(response, "status_code", None) == 502

