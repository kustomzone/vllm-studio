from __future__ import annotations

from parsers.minimax.streaming import StreamingParser


def test_minimax_streaming_emits_immediately():
    parser = StreamingParser()

    out1 = parser.process_chunk("Hello ")
    assert out1 is not None
    assert out1["type"] == "content"
    assert out1["raw_delta"] == "Hello "

    out2 = parser.process_chunk("world")
    assert out2 is not None
    assert out2["type"] == "content"
    assert out2["raw_delta"] == "world"


def test_minimax_streaming_tool_call_block_yields_content_then_tool_calls():
    parser = StreamingParser()

    first = parser.process_chunk("Hi\n<minimax:tool_call>\n<invoke name=\"weather\">")
    assert first is not None
    assert first["type"] == "content"
    assert first["raw_delta"] == "Hi\n"

    mid = parser.process_chunk("\n<parameter name=\"city\">\nParis\n</parameter>\n</invoke>\n")
    # Still inside tool call; nothing else should be emitted yet.
    assert mid is None

    last = parser.process_chunk("</minimax:tool_call>")
    assert last is not None
    assert last["type"] == "tool_calls"
    assert isinstance(last["tool_calls"], list)
    assert last["tool_calls"][0]["function"]["name"] == "weather"

