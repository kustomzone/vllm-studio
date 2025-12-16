from pathlib import Path

from vllmstudio.chat_store import ChatStore


def test_chat_store_add_message_preserves_id_and_counts_tokens(tmp_path: Path):
    store = ChatStore(db_path=tmp_path / "chats.db")
    session = store.create_session(title="Test", model="default")

    user = store.add_message(
        session_id=session.id,
        role="user",
        content="Hello world",
        model="default",
        message_id="user-1",
    )
    assert user.id == "user-1"
    assert user.prompt_tokens > 0
    assert user.total_tokens == user.prompt_tokens
    assert user.completion_tokens == 0

    assistant = store.add_message(
        session_id=session.id,
        role="assistant",
        content="Hi!",
        model="default",
        message_id="asst-1",
        tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "x", "arguments": "{\"a\":1}"}}],
        request_prompt_tokens=123,
        request_tools_tokens=10,
        request_total_input_tokens=133,
        request_completion_tokens=7,
    )
    assert assistant.id == "asst-1"
    assert assistant.completion_tokens > 0
    assert assistant.total_tokens == assistant.completion_tokens
    assert assistant.prompt_tokens == 0

    usage = store.get_session_usage(session.id)
    assert usage is not None
    # For assistant turns, usage prefers request-level accounting
    assert usage["prompt_tokens"] == user.prompt_tokens + 123
    assert usage["completion_tokens"] == 7
    assert usage["total_tokens"] == user.total_tokens + 123 + 7


def test_chat_store_fork_session(tmp_path: Path):
    store = ChatStore(db_path=tmp_path / "chats.db")
    session = store.create_session(title="Root", model="model-a")

    m1 = store.add_message(session_id=session.id, role="user", content="Q1", model="model-a", message_id="m1")
    _m2 = store.add_message(session_id=session.id, role="assistant", content="A1", model="model-a", message_id="m2")

    fork = store.fork_session(session.id, model="model-b", message_id=m1.id)
    assert fork is not None
    assert fork.parent_id == session.id
    assert fork.model == "model-b"
    assert fork.forked_from_message_id == m1.id
    assert len(fork.messages) == 1
    assert fork.messages[0].role == "user"
    assert fork.messages[0].content == "Q1"
