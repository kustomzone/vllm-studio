"""Parsers for model-specific output formats."""

# MiniMax parsers
from .minimax import (
    parse_tool_calls,
    tool_calls_to_minimax_xml,
    extract_json_tool_calls,
    StreamingParser,
)

# GLM parsers
from .glm import (
    parse_glm_tool_calls,
    tool_calls_to_glm_xml,
    extract_json_tool_calls_glm,
    GLMStreamingParser,
)

# Reasoning utilities
from .reasoning import split_think, ensure_think_wrapped, strip_enclosing_think, strip_box_tags

__all__ = [
    # MiniMax tools
    "parse_tool_calls",
    "tool_calls_to_minimax_xml",
    "extract_json_tool_calls",
    "StreamingParser",
    # GLM tools
    "parse_glm_tool_calls",
    "tool_calls_to_glm_xml",
    "extract_json_tool_calls_glm",
    "GLMStreamingParser",
    # Reasoning
    "split_think",
    "ensure_think_wrapped",
    "strip_enclosing_think",
    "strip_box_tags",
]
