"""
MCP (Model Context Protocol) Manager for vLLM Studio.
Handles connections to MCP servers and tool invocations.
"""

import asyncio
import json
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, field
from contextlib import asynccontextmanager

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


@dataclass
class MCPServer:
    """MCP server configuration."""
    name: str
    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class MCPTool:
    """Tool from an MCP server."""
    name: str
    description: str
    server: str
    input_schema: dict[str, Any]


@dataclass
class MCPResource:
    """Resource from an MCP server."""
    uri: str
    name: str
    description: str
    server: str
    mime_type: Optional[str] = None


class MCPManager:
    """Manages MCP server connections and tool invocations."""

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path.home() / ".config" / "mcp" / "servers.json"
        self.servers: dict[str, MCPServer] = {}
        self._sessions: dict[str, ClientSession] = {}
        self._tools_cache: dict[str, list[MCPTool]] = {}
        self._resources_cache: dict[str, list[MCPResource]] = {}
        self._load_config()

    def _load_config(self):
        """Load MCP server configuration."""
        if self.config_path.exists():
            try:
                with open(self.config_path) as f:
                    data = json.load(f)
                    for name, cfg in data.get("mcpServers", {}).items():
                        self.servers[name] = MCPServer(
                            name=name,
                            command=cfg.get("command", ""),
                            args=cfg.get("args", []),
                            env=cfg.get("env", {}),
                            enabled=cfg.get("enabled", True),
                        )
            except Exception as e:
                print(f"Failed to load MCP config: {e}")

        # Add default servers if none configured
        if not self.servers:
            self._add_default_servers()

    def _add_default_servers(self):
        """Add default MCP servers."""
        # Check for common MCP servers
        default_servers = [
            MCPServer(
                name="brave-search",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-brave-search"],
                env={"BRAVE_API_KEY": "BSAXS7ZocStxg8vT2z14r8hOWvTf6jt"},
                enabled=True,
            ),
            MCPServer(
                name="fetch",
                command="uvx",
                args=["mcp-server-fetch"],
                enabled=True,
            ),
            MCPServer(
                name="time",
                command="uvx",
                args=["mcp-server-time"],
                enabled=True,
            ),
        ]
        for server in default_servers:
            self.servers[server.name] = server

    def save_config(self):
        """Save MCP server configuration."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "mcpServers": {
                name: {
                    "command": s.command,
                    "args": s.args,
                    "env": s.env,
                    "enabled": s.enabled,
                }
                for name, s in self.servers.items()
            }
        }
        with open(self.config_path, "w") as f:
            json.dump(data, f, indent=2)

    def add_server(self, server: MCPServer):
        """Add an MCP server."""
        self.servers[server.name] = server
        self.save_config()

    def remove_server(self, name: str):
        """Remove an MCP server."""
        if name in self.servers:
            del self.servers[name]
            self.save_config()

    @asynccontextmanager
    async def _get_session(self, server_name: str):
        """Get or create a session for an MCP server."""
        server = self.servers.get(server_name)
        if not server or not server.enabled:
            raise ValueError(f"Server {server_name} not found or disabled")

        params = StdioServerParameters(
            command=server.command,
            args=server.args,
            env=server.env or None,
        )

        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session

    async def list_tools(self, server_name: Optional[str] = None) -> list[MCPTool]:
        """List tools from MCP servers."""
        tools = []
        servers_to_check = [server_name] if server_name else list(self.servers.keys())

        for name in servers_to_check:
            server = self.servers.get(name)
            if not server or not server.enabled:
                continue

            try:
                async with self._get_session(name) as session:
                    result = await session.list_tools()
                    for tool in result.tools:
                        tools.append(MCPTool(
                            name=tool.name,
                            description=tool.description or "",
                            server=name,
                            input_schema=tool.inputSchema if hasattr(tool, 'inputSchema') else {},
                        ))
            except Exception as e:
                print(f"Failed to list tools from {name}: {e}")

        return tools

    async def call_tool(self, server_name: str, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Call a tool on an MCP server."""
        try:
            async with self._get_session(server_name) as session:
                result = await session.call_tool(tool_name, arguments)
                # Extract content from result
                if hasattr(result, 'content') and result.content:
                    contents = []
                    for item in result.content:
                        if hasattr(item, 'text'):
                            contents.append(item.text)
                        elif hasattr(item, 'data'):
                            contents.append(item.data)
                    return "\n".join(str(c) for c in contents)
                return str(result)
        except Exception as e:
            return f"Error calling tool: {e}"

    async def list_resources(self, server_name: Optional[str] = None) -> list[MCPResource]:
        """List resources from MCP servers."""
        resources = []
        servers_to_check = [server_name] if server_name else list(self.servers.keys())

        for name in servers_to_check:
            server = self.servers.get(name)
            if not server or not server.enabled:
                continue

            try:
                async with self._get_session(name) as session:
                    result = await session.list_resources()
                    for res in result.resources:
                        resources.append(MCPResource(
                            uri=res.uri,
                            name=res.name,
                            description=res.description or "",
                            server=name,
                            mime_type=res.mimeType if hasattr(res, 'mimeType') else None,
                        ))
            except Exception as e:
                print(f"Failed to list resources from {name}: {e}")

        return resources

    async def read_resource(self, server_name: str, uri: str) -> str:
        """Read a resource from an MCP server."""
        try:
            async with self._get_session(server_name) as session:
                result = await session.read_resource(uri)
                if hasattr(result, 'contents') and result.contents:
                    contents = []
                    for item in result.contents:
                        if hasattr(item, 'text'):
                            contents.append(item.text)
                        elif hasattr(item, 'blob'):
                            contents.append(f"[Binary data: {len(item.blob)} bytes]")
                    return "\n".join(contents)
                return str(result)
        except Exception as e:
            return f"Error reading resource: {e}"

    def get_servers_info(self) -> list[dict]:
        """Get info about configured servers."""
        return [
            {
                "name": s.name,
                "command": s.command,
                "args": s.args,
                "enabled": s.enabled,
            }
            for s in self.servers.values()
        ]


# Global instance
_mcp_manager: Optional[MCPManager] = None


def get_mcp_manager() -> MCPManager:
    """Get the global MCP manager instance."""
    global _mcp_manager
    if _mcp_manager is None:
        _mcp_manager = MCPManager()
    return _mcp_manager
