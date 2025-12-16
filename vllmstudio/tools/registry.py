"""Tool registry for managing available tools."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable, Any
from enum import Enum
import json


class ToolType(str, Enum):
    BUILTIN = "builtin"
    PYTHON = "python"
    MCP = "mcp"
    CUSTOM = "custom"


@dataclass
class ToolParameter:
    """Definition of a tool parameter."""
    name: str
    type: str  # string, number, boolean, array, object
    description: str
    required: bool = True
    default: Any = None
    enum: Optional[List[str]] = None


@dataclass
class Tool:
    """Definition of a tool."""
    name: str
    description: str
    parameters: List[ToolParameter] = field(default_factory=list)
    tool_type: ToolType = ToolType.BUILTIN
    enabled: bool = True
    handler: Optional[Callable] = None
    mcp_server: Optional[str] = None  # For MCP tools, the server name
    
    def to_openai_schema(self) -> Dict:
        """Convert to OpenAI function calling schema."""
        properties = {}
        required = []
        
        for param in self.parameters:
            prop = {"type": param.type, "description": param.description}
            if param.enum:
                prop["enum"] = param.enum
            properties[param.name] = prop
            if param.required:
                required.append(param.name)
        
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                }
            }
        }


class ToolRegistry:
    """Registry for managing tools."""
    
    def __init__(self):
        self._tools: Dict[str, Tool] = {}
        self._mcp_servers: Dict[str, Any] = {}
    
    def register(self, tool: Tool) -> None:
        """Register a tool."""
        self._tools[tool.name] = tool
    
    def unregister(self, name: str) -> bool:
        """Unregister a tool."""
        if name in self._tools:
            del self._tools[name]
            return True
        return False
    
    def get(self, name: str) -> Optional[Tool]:
        """Get a tool by name."""
        return self._tools.get(name)
    
    def list_tools(self, enabled_only: bool = False) -> List[Tool]:
        """List all registered tools."""
        tools = list(self._tools.values())
        if enabled_only:
            tools = [t for t in tools if t.enabled]
        return tools
    
    def enable(self, name: str) -> bool:
        """Enable a tool."""
        if name in self._tools:
            self._tools[name].enabled = True
            return True
        return False
    
    def disable(self, name: str) -> bool:
        """Disable a tool."""
        if name in self._tools:
            self._tools[name].enabled = False
            return True
        return False
    
    def get_openai_tools(self) -> List[Dict]:
        """Get all enabled tools in OpenAI format."""
        return [t.to_openai_schema() for t in self.list_tools(enabled_only=True)]
    
    def to_dict(self) -> List[Dict]:
        """Serialize registry to dict."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "type": t.tool_type.value,
                "enabled": t.enabled,
                "parameters": [
                    {
                        "name": p.name,
                        "type": p.type,
                        "description": p.description,
                        "required": p.required,
                    }
                    for p in t.parameters
                ],
            }
            for t in self._tools.values()
        ]


# Global registry instance
_registry = ToolRegistry()


def get_registry() -> ToolRegistry:
    """Get the global tool registry."""
    return _registry
