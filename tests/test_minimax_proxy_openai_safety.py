from __future__ import annotations

import asyncio


class FakeTabbyClient:
    def __init__(self, *_args, **_kwargs) -> None:
        self.last_messages = None
        self.last_kwargs = None

    async def close(self) -> None:
        return None

    async def health_check(self) -> bool:
        return True

    async def chat_completion(self, *, messages, model, **kwargs):
        self.last_messages = messages
        self.last_kwargs = {"model": model, **kwargs}
        return {"choices": [{"message": {"content": "ok"}}]}


def test_openai_minimax_clamps_max_tokens(monkeypatch):
    import proxy.main as proxy_main
    from proxy.models import OpenAIChatRequest

    fake = FakeTabbyClient()

    monkeypatch.setattr(proxy_main, "tabby_client", fake)

    req = OpenAIChatRequest(
        model="minimax-m2",
        max_tokens=100000,
        messages=[{"role": "user", "content": "hi"}],
    )
    asyncio.run(proxy_main.complete_openai_response(req, session_id=None))

    assert fake.last_kwargs is not None
    assert fake.last_kwargs["max_tokens"] == 8192


def test_openai_minimax_normalizes_tool_role_messages(monkeypatch):
    import proxy.main as proxy_main
    from proxy.models import OpenAIChatRequest

    fake = FakeTabbyClient()

    monkeypatch.setattr(proxy_main, "tabby_client", fake)

    req = OpenAIChatRequest(
        model="minimax-m2",
        messages=[
            {"role": "user", "content": "call tool"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "call_123",
                        "type": "function",
                        "function": {"name": "weather", "arguments": "{\"city\":\"Paris\"}"},
                    }
                ],
            },
            {"role": "tool", "tool_call_id": "call_123", "content": "{\"temp_c\": 19}"},
        ],
    )
    asyncio.run(proxy_main.complete_openai_response(req, session_id=None))

    assert fake.last_messages is not None
    assert all(msg.get("role") != "tool" for msg in fake.last_messages)
    assert fake.last_messages[-1]["role"] == "user"
    assert fake.last_messages[-1]["name"] == "tool_result"
    assert "call_123" in fake.last_messages[-1]["content"]
