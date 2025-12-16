"""MiniMax-M2 model parsers for tool calls and streaming."""

from .tools import (
    parse_tool_calls,
    tool_calls_to_minimax_xml,
    extract_json_tool_calls,
)
from .streaming import StreamingParser

__all__ = [
    "parse_tool_calls",
    "tool_calls_to_minimax_xml",
    "extract_json_tool_calls",
    "StreamingParser",
]
