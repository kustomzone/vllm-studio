"""Streaming parser for MiniMax-M2 responses."""

from typing import Any, Dict, List, Optional

from ..reasoning import split_think
from .tools import parse_tool_calls


class StreamingParser:
    """Buffering parser that extracts tool calls while streaming.

    Goals:
    - Never block emitting content deltas (avoid "stuck" streams while the model thinks).
    - Detect and parse `<minimax:tool_call>...</minimax:tool_call>` blocks once complete.
    """

    def __init__(self) -> None:
        self.buffer = ""
        self.sent_position = 0  # How much raw content we've already emitted
        self.tools_sent = False
        self.tools: Optional[List[Dict[str, Any]]] = None
        self.last_tool_calls: Optional[List[Dict[str, Any]]] = None

    def set_tools(self, tools: Optional[List[Dict[str, Any]]]) -> None:
        """Set tools for type conversion during parsing."""
        self.tools = tools

    def has_tool_calls(self) -> bool:
        """Check if tool calls were detected."""
        return self.tools_sent

    def process_chunk(self, chunk: str) -> Optional[Dict[str, Any]]:
        """
        Process incoming chunk and return delta information.

        Returns dict with keys:
            - type: "content" or "tool_calls" or "reasoning"
            - raw_delta: Raw text delta (with <think> tags) when applicable
            - content_delta: Visible text delta (outside <think>)
            - reasoning_delta: Reasoning text delta
            - tool_calls: Parsed tool call payload when available
        """
        self.buffer += chunk

        has_start = "<minimax:tool_call>" in self.buffer
        has_end = "</minimax:tool_call>" in self.buffer

        if has_start and not has_end:
            if not self.tools_sent:
                tool_start_idx = self.buffer.find("<minimax:tool_call>")
                content_before = self.buffer[:tool_start_idx]

                if len(content_before) > self.sent_position:
                    delta = content_before[self.sent_position :]
                    self.sent_position = len(content_before)
                    think_text, visible_text = split_think(delta)
                    result: Dict[str, Any] = {
                        "type": "content",
                        "raw_delta": delta,
                        "content_delta": visible_text or None,
                    }
                    if think_text:
                        result["reasoning_delta"] = think_text
                    return result

            return None

        if has_start and has_end and not self.tools_sent:
            result = parse_tool_calls(self.buffer, self.tools)

            if result["tools_called"]:
                self.tools_sent = True
                self.last_tool_calls = result["tool_calls"]

                tool_start_idx = self.buffer.find("<minimax:tool_call>")
                content_before = self.buffer[:tool_start_idx]

                if len(content_before) > self.sent_position:
                    delta = content_before[self.sent_position :]
                    self.sent_position = tool_start_idx
                    think_text, visible_text = split_think(delta)
                    response: Dict[str, Any] = {
                        "type": "content",
                        "raw_delta": delta,
                        "content_delta": visible_text or None,
                    }
                    if think_text:
                        response["reasoning_delta"] = think_text
                    return response

                tool_end_idx = self.buffer.find("</minimax:tool_call>")
                if tool_end_idx == -1:
                    tool_end_idx = len(self.buffer)
                else:
                    tool_end_idx += len("</minimax:tool_call>")

                tool_delta = self.buffer[self.sent_position:tool_end_idx]
                self.sent_position = tool_end_idx
                payload: Dict[str, Any] = {
                    "type": "tool_calls",
                    "tool_calls": result["tool_calls"],
                }
                if tool_delta:
                    payload["raw_delta"] = tool_delta
                return payload

        if len(self.buffer) > self.sent_position:
            delta = self.buffer[self.sent_position :]
            self.sent_position = len(self.buffer)
            think_text, visible_text = split_think(delta)

            result: Dict[str, Any] = {
                "type": "content",
                "raw_delta": delta,
                "content_delta": visible_text or None,
            }

            if think_text:
                result["reasoning_delta"] = think_text

            return result

        return None

    def flush_pending(self) -> Optional[Dict[str, Any]]:
        """Flush any remaining buffered content at stream end."""
        if len(self.buffer) > self.sent_position:
            remaining = self.buffer[self.sent_position :]
            self.sent_position = len(self.buffer)
            think_text, visible_text = split_think(remaining)
            result: Dict[str, Any] = {
                "raw_delta": remaining,
                "content_delta": visible_text or None,
            }
            if think_text:
                result["reasoning_delta"] = think_text
            return result
        return None

    def get_final_content(self) -> str:
        """Get complete final content as streamed (including tool blocks)."""
        return self.buffer

    def get_last_tool_calls(self) -> Optional[List[Dict[str, Any]]]:
        """Return the most recently parsed tool calls, if any."""
        return self.last_tool_calls
