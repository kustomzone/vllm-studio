from __future__ import annotations

import json
from pathlib import Path

import parsers.pipeline as pipeline


def _scrub_tool_call_ids(messages: list[dict]) -> list[dict]:
    scrubbed = []
    for msg in messages:
        msg = dict(msg)
        if "tool_calls" in msg and isinstance(msg["tool_calls"], list):
            tcs = []
            for tc in msg["tool_calls"]:
                tc = json.loads(json.dumps(tc))
                tc["id"] = "call_FIXED"
                tcs.append(tc)
            msg["tool_calls"] = tcs
        scrubbed.append(msg)
    return scrubbed


def test_normalize_history_for_backend_golden_fixtures():
    fixtures_dir = Path(__file__).parent / "fixtures" / "parsers"
    for name in (
        "normalize_history_minimax.json",
        "normalize_history_minimax_tool_results.json",
        "normalize_history_glm.json",
        "normalize_history_mistral.json",
    ):
        payload = json.loads((fixtures_dir / name).read_text())
        family = payload["family"]
        messages = payload["messages"]
        expected = payload["expected"]

        got = pipeline.normalize_history_for_backend(messages, family=family, tools=None)
        assert _scrub_tool_call_ids(got) == expected
