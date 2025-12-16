"""Tool call parser for Mistral/Devstral format

Devstral-2 tool call format:
[TOOL_CALLS]function_name[ARGS]{"arg1": "value1", "arg2": "value2"}

Multiple tool calls can appear in a single response.
"""

import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Regex patterns for Mistral tool calls
TOOL_CALL_PATTERN = re.compile(
    r'\[TOOL_CALLS\]([^\[\]]+)\[ARGS\](\{.*?\})(?=\[TOOL_CALLS\]|$)',
    re.DOTALL
)

# Simpler pattern for single tool call at end
SINGLE_TOOL_CALL_PATTERN = re.compile(
    r'\[TOOL_CALLS\](\w+)\[ARGS\](.+)$',
    re.DOTALL
)


def tool_calls_to_mistral_format(tool_calls: Optional[List[Dict[str, Any]]]) -> Optional[str]:
    """Render OpenAI-format tool calls as Mistral format.

    Args:
        tool_calls: List of OpenAI-format tool calls

    Returns:
        Mistral-formatted string or None if no tool calls
    """
    if not tool_calls:
        return None

    parts: List[str] = []

    for call in tool_calls:
        function = call.get("function", {}) if isinstance(call, dict) else {}
        name = function.get("name") or call.get("name") or ""
        arguments = function.get("arguments") or "{}"

        # Ensure arguments is a valid JSON string
        if isinstance(arguments, dict):
            arguments = json.dumps(arguments, ensure_ascii=False)
        elif isinstance(arguments, str):
            # Validate it's valid JSON
            try:
                json.loads(arguments)
            except json.JSONDecodeError:
                arguments = "{}"

        parts.append(f"[TOOL_CALLS]{name}[ARGS]{arguments}")

    return "".join(parts)


def parse_mistral_tool_calls(model_output: str, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
    """
    Extract all tool calls from Mistral/Devstral model output.

    Args:
        model_output: Complete output text from the model
        tools: Tool definition list (unused but kept for API compatibility)

    Returns:
        {
            "tools_called": bool,
            "tool_calls": List[Dict],  # OpenAI format
            "content": str  # Content without tool call blocks
        }
    """
    if not model_output:
        return {
            "tools_called": False,
            "tool_calls": [],
            "content": model_output
        }

    # Quick check if tool call marker is present
    if "[TOOL_CALLS]" not in model_output:
        return {
            "tools_called": False,
            "tool_calls": [],
            "content": model_output
        }

    tool_calls = []
    content = model_output

    try:
        # First try the multi-tool pattern
        matches = TOOL_CALL_PATTERN.findall(model_output)

        if not matches:
            # Try simpler single tool pattern
            match = SINGLE_TOOL_CALL_PATTERN.search(model_output)
            if match:
                function_name = match.group(1).strip()
                args_str = match.group(2).strip()

                # Try to parse JSON arguments
                try:
                    # Find the JSON object boundaries
                    if args_str.startswith('{'):
                        # Find matching closing brace
                        brace_count = 0
                        end_idx = 0
                        for i, char in enumerate(args_str):
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    end_idx = i + 1
                                    break
                        args_str = args_str[:end_idx]

                    arguments = json.loads(args_str)
                    arguments_str = json.dumps(arguments, ensure_ascii=False)
                except json.JSONDecodeError:
                    arguments_str = args_str

                tool_calls.append({
                    "id": f"chatcmpl-tool-{uuid.uuid4().hex[:16]}",
                    "type": "function",
                    "function": {
                        "name": function_name,
                        "arguments": arguments_str
                    }
                })

                # Extract content before the tool call
                content = model_output[:match.start()].strip()
        else:
            for function_name, args_str in matches:
                function_name = function_name.strip()
                args_str = args_str.strip()

                # Validate function name
                if not function_name or len(function_name) > 100:
                    logger.warning(f"Invalid function name: {function_name[:50]}...")
                    continue

                # Parse arguments
                try:
                    arguments = json.loads(args_str)
                    arguments_str = json.dumps(arguments, ensure_ascii=False)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse arguments for {function_name}: {args_str[:100]}...")
                    arguments_str = args_str

                tool_calls.append({
                    "id": f"chatcmpl-tool-{uuid.uuid4().hex[:16]}",
                    "type": "function",
                    "function": {
                        "name": function_name,
                        "arguments": arguments_str
                    }
                })

            # Extract content by removing all tool call blocks
            content = re.sub(
                r'\[TOOL_CALLS\][^\[\]]+\[ARGS\]\{.*?\}(?=\[TOOL_CALLS\]|$)',
                '',
                model_output,
                flags=re.DOTALL
            ).strip()

    except Exception as e:
        logger.error(f"Failed to parse Mistral tool calls: {e}")
        return {
            "tools_called": False,
            "tool_calls": [],
            "content": model_output
        }

    if not tool_calls:
        return {
            "tools_called": False,
            "tool_calls": [],
            "content": model_output
        }

    return {
        "tools_called": True,
        "tool_calls": tool_calls,
        "content": content if content else None
    }


def extract_json_tool_calls_mistral(model_output: str) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Detect and extract trailing JSON tool call payloads at the end of the response.
    Some configurations may output tool calls as pure JSON instead of [TOOL_CALLS] format.

    Returns:
        Tuple of (content without JSON, list of tool calls or None)
    """
    if not model_output:
        return model_output, None

    trimmed = model_output.rstrip()

    # Try to find JSON array first (multiple tool calls)
    if trimmed.endswith("]"):
        start_idx = trimmed.rfind("[")
        if start_idx != -1:
            candidate = trimmed[start_idx:]
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, list) and parsed:
                    tool_calls = _parse_json_tool_list(parsed)
                    if tool_calls:
                        clean_content = trimmed[:start_idx].rstrip()
                        return clean_content, tool_calls
            except json.JSONDecodeError:
                pass

    # Try to find single JSON object
    if trimmed.endswith("}"):
        brace_count = 0
        start_idx = -1
        for i in range(len(trimmed) - 1, -1, -1):
            if trimmed[i] == '}':
                brace_count += 1
            elif trimmed[i] == '{':
                brace_count -= 1
                if brace_count == 0:
                    start_idx = i
                    break

        if start_idx != -1:
            candidate = trimmed[start_idx:]
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    tool_call = _parse_single_json_tool(parsed)
                    if tool_call:
                        clean_content = trimmed[:start_idx].rstrip()
                        return clean_content, [tool_call]
            except json.JSONDecodeError:
                pass

    return model_output, None


def _parse_json_tool_list(parsed: List[Any]) -> Optional[List[Dict[str, Any]]]:
    """Parse a list of JSON tool calls into OpenAI format."""
    tool_calls: List[Dict[str, Any]] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            return None

        tool_call = _parse_single_json_tool(entry)
        if not tool_call:
            return None
        tool_calls.append(tool_call)

    return tool_calls if tool_calls else None


def _parse_single_json_tool(entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse a single JSON tool call dict into OpenAI format."""
    name = entry.get("name")

    if not name or not isinstance(name, str) or not name.strip():
        return None

    parameters = entry.get("parameters") or entry.get("args") or entry.get("arguments") or {}
    if isinstance(parameters, str):
        try:
            parameters = json.loads(parameters)
        except json.JSONDecodeError:
            parameters = {}

    arguments = json.dumps(parameters if parameters is not None else {}, ensure_ascii=False)

    return {
        "id": f"chatcmpl-tool-{uuid.uuid4().hex[:16]}",
        "type": "function",
        "function": {
            "name": name,
            "arguments": arguments
        }
    }


def normalize_mistral_tool_result(tool_call_id: str, result: str) -> Dict[str, Any]:
    """
    Format a tool result for Mistral's expected message format.

    Returns an OpenAI-compatible tool message dict.
    """
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": result
    }
