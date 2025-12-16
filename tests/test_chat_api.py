from pathlib import Path

from fastapi.testclient import TestClient

import vllmstudio.api as api_module
from vllmstudio.chat_store import ChatStore


def test_chat_api_endpoints(monkeypatch, tmp_path: Path):
    store = ChatStore(db_path=tmp_path / "chats.db")
    monkeypatch.setattr(api_module, "chat_store", store)

    client = TestClient(api_module.app)

    # Create session
    r = client.post("/chats?title=Test&model=model-a")
    assert r.status_code == 200
    session = r.json()
    session_id = session["id"]
    assert session["model"] == "model-a"

    # Add message with stable id
    r = client.post(
        f"/chats/{session_id}/messages",
        json={"id": "u1", "role": "user", "content": "hello", "model": "model-a"},
    )
    assert r.status_code == 200
    msg = r.json()
    assert msg["id"] == "u1"
    assert msg["prompt_tokens"] > 0
    assert msg["total_tokens"] == msg["prompt_tokens"]

    # Add assistant message with request token overrides
    r = client.post(
        f"/chats/{session_id}/messages",
        json={
            "id": "a1",
            "role": "assistant",
            "content": "hi",
            "model": "model-a",
            "request_prompt_tokens": 50,
            "request_tools_tokens": 5,
            "request_total_input_tokens": 55,
            "request_completion_tokens": 3,
        },
    )
    assert r.status_code == 200
    msg = r.json()
    assert msg["id"] == "a1"
    assert msg["request_total_input_tokens"] == 55
    assert msg["request_completion_tokens"] == 3

    # Fork session
    r = client.post(f"/chats/{session_id}/fork", json={"model": "model-b", "message_id": "u1"})
    assert r.status_code == 200
    fork = r.json()
    assert fork["parent_id"] == session_id
    assert fork["model"] == "model-b"
    assert fork["forked_from_message_id"] == "u1"
    assert len(fork["messages"]) == 1

    # Usage
    r = client.get(f"/chats/{session_id}/usage")
    assert r.status_code == 200
    usage = r.json()
    assert usage["session_id"] == session_id
    assert usage["prompt_tokens"] > 0
    assert usage["completion_tokens"] >= 3
