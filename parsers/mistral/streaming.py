"""Streaming parser for Mistral/Devstral responses."""

from typing import Any, Dict, List, Optional

from ..reasoning import split_think
from .tools import parse_mistral_tool_calls


class MistralStreamingParser:
    """Buffering parser for Mistral streaming responses with tool call support.

    Devstral-2 format uses:
    - [TOOL_CALLS]function_name[ARGS]{"arg": "value"} for tool calls
    - Standard text content (no special thinking tags)
    """

    def __init__(self) -> None:
        self.buffer = ""
        self.sent_position = 0  # How much raw content we've already emitted
        self.tools_sent = False
        self.tools: Optional[List[Dict[str, Any]]] = None
        self.think_status_determined = False
        self.has_think_closing = False
        self.think_opening_sent = False
        self.reasoning_len_sent = 0
        self.last_tool_calls: Optional[List[Dict[str, Any]]] = None

    def set_tools(self, tools: Optional[List[Dict[str, Any]]]) -> None:
        """Set tools for type conversion during parsing."""
        self.tools = tools

    def has_tool_calls(self) -> bool:
        """Check if tool calls were detected."""
        return self.tools_sent

    def _compute_reasoning_delta(self) -> str:
        """Return incremental reasoning text (inside <think>...</think>).

        Mistral models may or may not use thinking tags, so this handles both cases.
        """
        if "</think>" not in self.buffer and "<think>" not in self.buffer:
            return ""

        closing_idx = self.buffer.find("</think>")
        if closing_idx == -1:
            return ""

        reasoning_segment = self.buffer[:closing_idx]
        if reasoning_segment.startswith("<think>"):
            reasoning_segment = reasoning_segment[len("<think>"):]

        if len(reasoning_segment) <= self.reasoning_len_sent:
            return ""

        delta = reasoning_segment[self.reasoning_len_sent:]
        self.reasoning_len_sent = len(reasoning_segment)
        return delta

    def process_chunk(self, chunk: str) -> Optional[Dict[str, Any]]:
        """
        Process incoming chunk and return delta information.

        Returns dict with keys:
            - type: "content" or "tool_calls" or "reasoning"
            - raw_delta: Raw text delta when applicable
            - content_delta: Visible text delta
            - reasoning_delta: Reasoning text delta
            - tool_calls: Parsed tool call payload when available
        """
        self.buffer += chunk
        reasoning_delta = self._compute_reasoning_delta()

        # Determine think status if not yet done
        if not self.think_status_determined:
            if "</think>" in self.buffer:
                self.think_status_determined = True
                self.has_think_closing = True
            elif "[TOOL_CALLS]" in self.buffer:
                self.think_status_determined = True
                self.has_think_closing = False
            elif "[" in self.buffer:
                # Could be start of [TOOL_CALLS], wait for more
                # Only emit content before the potential marker
                bracket_idx = self.buffer.find("[")
                if bracket_idx > self.sent_position:
                    delta = self.buffer[self.sent_position:bracket_idx]
                    self.sent_position = bracket_idx
                    if delta:
                        return {
                            "type": "content",
                            "raw_delta": delta,
                            "content_delta": delta,
                        }
                return None
            else:
                if reasoning_delta:
                    return {"type": "reasoning", "reasoning_delta": reasoning_delta}
                # For non-thinking content, emit as we receive but check for partial markers
                # Keep a reasonable buffer to detect [TOOL_CALLS] which is 12 chars
                min_buffer = 15
                if len(self.buffer) > self.sent_position + min_buffer:
                    safe_emit_len = len(self.buffer) - min_buffer
                    delta = self.buffer[self.sent_position:safe_emit_len]
                    self.sent_position = safe_emit_len
                    if delta:
                        return {
                            "type": "content",
                            "raw_delta": delta,
                            "content_delta": delta,
                        }
                return None

        has_tool_start = "[TOOL_CALLS]" in self.buffer
        has_args = "[ARGS]" in self.buffer

        # If we see [TOOL_CALLS] but not yet [ARGS], wait for more
        if has_tool_start and not has_args:
            tool_start_idx = self.buffer.find("[TOOL_CALLS]")
            content_before = self.buffer[:tool_start_idx]

            if len(content_before) > self.sent_position:
                delta = content_before[self.sent_position:]
                if self.sent_position == 0 and not self.think_opening_sent and self.has_think_closing:
                    self.think_opening_sent = True
                    delta = "<think>\n" + delta
                self.sent_position = len(content_before)
                think_text, visible_text = split_think(delta)
                result: Dict[str, Any] = {
                    "type": "content",
                    "raw_delta": delta,
                    "content_delta": visible_text or None,
                }
                aggregate_reasoning = reasoning_delta or think_text
                if aggregate_reasoning:
                    result["reasoning_delta"] = aggregate_reasoning
                return result

            if reasoning_delta:
                return {"type": "reasoning", "reasoning_delta": reasoning_delta}
            return None

        # Try to parse complete tool calls
        if has_tool_start and has_args and not self.tools_sent:
            # Try to find complete JSON after [ARGS]
            args_idx = self.buffer.find("[ARGS]")
            if args_idx != -1:
                after_args = self.buffer[args_idx + len("[ARGS]"):]

                # Check if we have a complete JSON object
                if after_args.startswith("{"):
                    brace_count = 0
                    json_complete = False
                    for i, char in enumerate(after_args):
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                json_complete = True
                                break

                    if json_complete:
                        result = parse_mistral_tool_calls(self.buffer, self.tools)

                        if result["tools_called"]:
                            self.tools_sent = True
                            self.last_tool_calls = result["tool_calls"]

                            tool_start_idx = self.buffer.find("[TOOL_CALLS]")
                            content_before = self.buffer[:tool_start_idx]

                            if len(content_before) > self.sent_position:
                                delta = content_before[self.sent_position:]
                                if self.sent_position == 0 and not self.think_opening_sent and self.has_think_closing:
                                    self.think_opening_sent = True
                                    delta = "<think>\n" + delta
                                self.sent_position = tool_start_idx
                                think_text, visible_text = split_think(delta)
                                response: Dict[str, Any] = {
                                    "type": "content",
                                    "raw_delta": delta,
                                    "content_delta": visible_text or None,
                                }
                                aggregate_reasoning = reasoning_delta or think_text
                                if aggregate_reasoning:
                                    response["reasoning_delta"] = aggregate_reasoning
                                return response

                            # Emit tool calls
                            self.sent_position = len(self.buffer)
                            payload: Dict[str, Any] = {
                                "type": "tool_calls",
                                "tool_calls": result["tool_calls"],
                            }
                            if reasoning_delta:
                                payload["reasoning_delta"] = reasoning_delta
                            return payload

            # Still waiting for complete tool call, emit content before
            tool_start_idx = self.buffer.find("[TOOL_CALLS]")
            if tool_start_idx > self.sent_position:
                delta = self.buffer[self.sent_position:tool_start_idx]
                if self.sent_position == 0 and not self.think_opening_sent and self.has_think_closing:
                    self.think_opening_sent = True
                    delta = "<think>\n" + delta
                self.sent_position = tool_start_idx
                think_text, visible_text = split_think(delta)
                result: Dict[str, Any] = {
                    "type": "content",
                    "raw_delta": delta,
                    "content_delta": visible_text or None,
                }
                aggregate_reasoning = reasoning_delta or think_text
                if aggregate_reasoning:
                    result["reasoning_delta"] = aggregate_reasoning
                return result

            if reasoning_delta:
                return {"type": "reasoning", "reasoning_delta": reasoning_delta}
            return None

        # No tool calls, emit buffered content
        if len(self.buffer) > self.sent_position:
            delta = self.buffer[self.sent_position:]
            if self.sent_position == 0 and not self.think_opening_sent and self.has_think_closing:
                self.think_opening_sent = True
                delta = "<think>\n" + delta
            self.sent_position = len(self.buffer)
            think_text, visible_text = split_think(delta)

            result: Dict[str, Any] = {
                "type": "content",
                "raw_delta": delta,
                "content_delta": visible_text or None,
            }

            aggregate_reasoning = reasoning_delta or think_text
            if aggregate_reasoning:
                result["reasoning_delta"] = aggregate_reasoning

            return result

        if reasoning_delta:
            return {"type": "reasoning", "reasoning_delta": reasoning_delta}
        return None

    def flush_pending(self) -> Optional[Dict[str, Any]]:
        """Flush any remaining buffered content at stream end."""
        # Check for unparsed tool calls at flush
        if not self.tools_sent and "[TOOL_CALLS]" in self.buffer:
            result = parse_mistral_tool_calls(self.buffer, self.tools)
            if result["tools_called"]:
                self.tools_sent = True
                self.last_tool_calls = result["tool_calls"]

                # Return content before tool calls
                tool_start_idx = self.buffer.find("[TOOL_CALLS]")
                if tool_start_idx > self.sent_position:
                    remaining = self.buffer[self.sent_position:tool_start_idx]
                    self.sent_position = len(self.buffer)
                    think_text, visible_text = split_think(remaining)
                    return {
                        "raw_delta": remaining,
                        "content_delta": visible_text or None,
                        "reasoning_delta": think_text if think_text else None,
                        "tool_calls": result["tool_calls"],
                    }

                return {
                    "tool_calls": result["tool_calls"],
                }

        if len(self.buffer) > self.sent_position:
            remaining = self.buffer[self.sent_position:]
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
        """Get complete final content as streamed."""
        return self.buffer

    def get_last_tool_calls(self) -> Optional[List[Dict[str, Any]]]:
        """Return the most recently parsed tool calls, if any."""
        return self.last_tool_calls
