"""Tool call parser for GLM-4 XML format

Based on GLM-4 chat template tool call format:
<tool_call>{function-name}
<arg_key>{arg-key-1}</arg_key>
<arg_value>{arg-value-1}</arg_value>
...
</tool_call>
"""

import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _format_param_value_for_xml(value: Any) -> str:
    """Convert a parameter value to string for XML embedding."""
    if isinstance(value, (dict, list)):
        try:
            return json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def tool_calls_to_glm_xml(tool_calls: Optional[List[Dict[str, Any]]]) -> Optional[str]:
    """Render OpenAI-format tool calls as GLM XML blocks."""
    if not tool_calls:
        return None

    blocks: List[str] = []

    for call in tool_calls:
        function = call.get("function", {}) if isinstance(call, dict) else {}
        name = function.get("name") or call.get("name") or ""

        lines: List[str] = [f"<tool_call>{name}"]

        arguments = function.get("arguments")
        parsed_args: Any = arguments

        if isinstance(arguments, str):
            try:
                parsed_args = json.loads(arguments)
            except json.JSONDecodeError:
                parsed_args = arguments

        if isinstance(parsed_args, dict):
            for param_name, param_value in parsed_args.items():
                lines.append(f"<arg_key>{param_name}</arg_key>")
                lines.append(f"<arg_value>{_format_param_value_for_xml(param_value)}</arg_value>")
        elif parsed_args:
            # Single value without key
            lines.append("<arg_key>input</arg_key>")
            lines.append(f"<arg_value>{_format_param_value_for_xml(parsed_args)}</arg_value>")

        lines.append("</tool_call>")
        blocks.append("\n".join(lines))

    return "\n".join(blocks)


def extract_name(name_str: str) -> str:
    """Extract name from quoted string"""
    name_str = name_str.strip()
    if (name_str.startswith('"') and name_str.endswith('"')) or \
       (name_str.startswith("'") and name_str.endswith("'")):
        return name_str[1:-1]
    return name_str


def convert_param_value(value: str, param_type: str) -> Any:
    """Convert parameter value based on parameter type"""
    if value.lower() == "null":
        return None

    param_type = param_type.lower()

    if param_type in ["string", "str", "text"]:
        return value
    elif param_type in ["integer", "int"]:
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    elif param_type in ["number", "float"]:
        try:
            val = float(value)
            return val if val != int(val) else int(val)
        except (ValueError, TypeError):
            return value
    elif param_type in ["boolean", "bool"]:
        return value.lower() in ["true", "1"]
    elif param_type in ["object", "array"]:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    else:
        # Try JSON parsing, return string if failed
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value


def parse_glm_tool_calls(model_output: str, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
    """
    Extract all tool calls from GLM model output.

    Args:
        model_output: Complete output text from the model
        tools: Tool definition list for getting parameter type information

    Returns:
        {
            "tools_called": bool,
            "tool_calls": List[Dict],  # OpenAI format
            "content": str  # Content without tool call blocks
        }
    """
    # Quick check if tool call marker is present
    if "<tool_call>" not in model_output:
        return {
            "tools_called": False,
            "tool_calls": [],
            "content": model_output
        }

    tool_calls = []

    try:
        # Match all <tool_call> blocks
        tool_call_regex = re.compile(r"<tool_call>(.*?)</tool_call>", re.DOTALL)

        # Iterate through all tool_call blocks
        for tool_call_content in tool_call_regex.findall(model_output):
            # Extract function name (first line/word before any <arg_key>)
            name_match = re.match(r"^\s*([^\s<]+)", tool_call_content)
            if not name_match:
                logger.warning(f"GLM tool call missing function name. Content: {tool_call_content[:100]}...")
                continue

            function_name = name_match.group(1).strip()

            # Validate function name looks reasonable (not a description)
            if len(function_name) > 50 or ':' in function_name or ' ' in function_name:
                logger.warning(f"GLM tool call has invalid function name '{function_name[:50]}'. "
                              f"Model may not support tool calling format.")
                continue

            # Get parameter configuration from tools
            param_config = {}
            if tools:
                for tool in tools:
                    tool_name = tool.get("name") or tool.get("function", {}).get("name")
                    if tool_name == function_name:
                        params = tool.get("parameters") or tool.get("function", {}).get("parameters")
                        if isinstance(params, dict) and "properties" in params:
                            param_config = params["properties"]
                        break

            # Extract parameters using <arg_key> and <arg_value> pairs
            param_dict = {}

            # Find all arg_key/arg_value pairs
            arg_key_regex = re.compile(r"<arg_key>(.*?)</arg_key>", re.DOTALL)
            arg_value_regex = re.compile(r"<arg_value>(.*?)</arg_value>", re.DOTALL)

            keys = arg_key_regex.findall(tool_call_content)
            values = arg_value_regex.findall(tool_call_content)

            for i, key in enumerate(keys):
                key = key.strip()
                if i < len(values):
                    value = values[i].strip()

                    # Get parameter type and convert
                    param_type = "string"
                    if key in param_config:
                        if isinstance(param_config[key], dict) and "type" in param_config[key]:
                            param_type = param_config[key]["type"]

                    param_dict[key] = convert_param_value(value, param_type)

            # Build OpenAI-format tool call
            tool_calls.append({
                "id": f"call_{uuid.uuid4().hex[:24]}",
                "type": "function",
                "function": {
                    "name": function_name,
                    "arguments": json.dumps(param_dict, ensure_ascii=False)
                }
            })

    except Exception as e:
        print(f"Failed to parse GLM tool calls: {e}")
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

    # Extract content without tool call blocks
    content_regex = re.compile(r"<tool_call>.*?</tool_call>", re.DOTALL)
    content = content_regex.sub('', model_output).strip()

    return {
        "tools_called": True,
        "tool_calls": tool_calls,
        "content": content if content else None
    }


def normalize_glm_tool_result(tool_id: str, result: str) -> str:
    """
    Format a tool result for GLM's expected format.

    GLM expects tool results in <tool_response> format after <|observation|> token.
    This is typically handled by the chat template, but we need to format properly.
    """
    return f"<tool_response>\n{result}\n</tool_response>"


def extract_json_tool_calls_glm(model_output: str) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Detect and extract trailing JSON tool call payloads at the end of the response content.
    Some models may output tool calls as JSON instead of XML.
    Handles both JSON arrays [...] and single JSON objects {...}.
    Returns the content without the JSON snippet and the parsed OpenAI-style tool calls.
    """
    if not model_output:
        return model_output, None

    trimmed = model_output.rstrip()

    # Try to find JSON array first
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

    # Try to find JSON object (single tool call)
    if trimmed.endswith("}"):
        # Find the matching opening brace
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

    # If no "name" field, check if it looks like a direct function call
    # e.g., {"title": "...", "description": "..."} for TodoWrite
    if not name:
        # This might be a malformed tool call where the args are at top level
        # We can't determine the function name, so return None
        return None

    if not isinstance(name, str) or not name.strip():
        return None

    parameters = entry.get("parameters") or entry.get("args") or entry.get("arguments") or {}
    if isinstance(parameters, str):
        try:
            parameters = json.loads(parameters)
        except json.JSONDecodeError:
            parameters = {}

    arguments = json.dumps(parameters if parameters is not None else {}, ensure_ascii=False)

    return {
        "id": f"call_{uuid.uuid4().hex[:24]}",
        "type": "function",
        "function": {
            "name": name,
            "arguments": arguments
        }
    }
