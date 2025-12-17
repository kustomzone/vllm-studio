from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    _MCP_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    ClientSession = None  # type: ignore[assignment]
    StdioServerParameters = None  # type: ignore[assignment]
    stdio_client = None  # type: ignore[assignment]
    _MCP_AVAILABLE = False


@dataclass
class MCPServer:
    name: str
    command: str
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True


@dataclass
class MCPTool:
    name: str
    description: str
    server: str
    input_schema: Dict[str, Any]


@dataclass
class MCPResource:
    uri: str
    name: str
    description: str
    server: str
    mime_type: Optional[str] = None


def _parse_servers_payload(payload: Any) -> List[MCPServer]:
    if not payload:
        return []

    # Supported formats:
    # - {"servers": [{...}, ...]}
    # - [{...}, ...]
    # - legacy MCP format: {"mcpServers": {"name": {...}, ...}}
    if isinstance(payload, dict):
        if isinstance(payload.get("servers"), list):
            payload = payload["servers"]
        elif isinstance(payload.get("mcpServers"), dict):
            servers: List[MCPServer] = []
            for name, cfg in payload["mcpServers"].items():
                if not isinstance(cfg, dict):
                    continue
                servers.append(
                    MCPServer(
                        name=str(name),
                        command=str(cfg.get("command") or ""),
                        args=[str(a) for a in (cfg.get("args") or [])],
                        env={str(k): str(v) for k, v in (cfg.get("env") or {}).items()},
                        enabled=bool(cfg.get("enabled", True)),
                    )
                )
            return [s for s in servers if s.name and s.command]

    if not isinstance(payload, list):
        return []

    servers: List[MCPServer] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        command = str(item.get("command") or "").strip()
        if not name or not command:
            continue
        args = item.get("args") or []
        env = item.get("env") or {}
        servers.append(
            MCPServer(
                name=name,
                command=command,
                args=[str(a) for a in args] if isinstance(args, list) else [],
                env={str(k): str(v) for k, v in env.items()} if isinstance(env, dict) else {},
                enabled=bool(item.get("enabled", True)),
            )
        )
    return servers


class MCPManager:
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.servers: Dict[str, MCPServer] = {}
        self._load()

    def _load(self) -> None:
        payload: Any = None
        if self.config_path.exists():
            try:
                payload = json.loads(self.config_path.read_text(encoding="utf-8"))
            except Exception:
                payload = None

        servers = _parse_servers_payload(payload)
        if not servers:
            servers = self._default_servers()
        self.servers = {s.name: s for s in servers}

    def save(self) -> None:
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "servers": [
                {
                    "name": s.name,
                    "command": s.command,
                    "args": s.args,
                    "env": s.env,
                    "enabled": s.enabled,
                }
                for s in self.servers.values()
            ]
        }
        self.config_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    def _default_servers(self) -> List[MCPServer]:
        brave_key = os.environ.get("BRAVE_API_KEY")
        defaults = [
            MCPServer(
                name="brave-search",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-brave-search"],
                env={k: v for k, v in {"BRAVE_API_KEY": brave_key}.items() if v},
                enabled=True,
            ),
            MCPServer(name="fetch", command="uvx", args=["mcp-server-fetch"], enabled=True),
            MCPServer(name="time", command="uvx", args=["mcp-server-time"], enabled=True),
        ]
        return defaults

    def list_servers(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": s.name,
                "command": s.command,
                "args": s.args,
                "env": s.env,
                "enabled": s.enabled,
            }
            for s in self.servers.values()
        ]

    def add_or_replace(self, server: MCPServer) -> None:
        self.servers[server.name] = server
        self.save()

    def remove(self, name: str) -> None:
        self.servers.pop(name, None)
        self.save()

    @asynccontextmanager
    async def _get_session(self, server_name: str):
        if not _MCP_AVAILABLE:
            raise RuntimeError("MCP python package not installed")

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

    async def list_tools(self, server_name: Optional[str] = None) -> List[MCPTool]:
        tools: List[MCPTool] = []
        targets = [server_name] if server_name else list(self.servers.keys())
        for name in targets:
            server = self.servers.get(name)
            if not server or not server.enabled:
                continue
            try:
                async with self._get_session(name) as session:
                    result = await session.list_tools()
                    for tool in result.tools:
                        schema = getattr(tool, "inputSchema", None) or {}
                        tools.append(
                            MCPTool(
                                name=tool.name,
                                description=tool.description or "",
                                server=name,
                                input_schema=schema,
                            )
                        )
            except Exception:
                continue
        return tools

    async def call_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
        async with self._get_session(server_name) as session:
            result = await session.call_tool(tool_name, arguments or {})
            content = getattr(result, "content", None)
            if content:
                parts: List[str] = []
                for item in content:
                    if hasattr(item, "text"):
                        parts.append(str(item.text))
                    elif hasattr(item, "data"):
                        parts.append(str(item.data))
                return "\n".join(parts)
            return str(result)

    async def list_resources(self, server_name: Optional[str] = None) -> List[MCPResource]:
        resources: List[MCPResource] = []
        targets = [server_name] if server_name else list(self.servers.keys())
        for name in targets:
            server = self.servers.get(name)
            if not server or not server.enabled:
                continue
            try:
                async with self._get_session(name) as session:
                    result = await session.list_resources()
                    for res in result.resources:
                        resources.append(
                            MCPResource(
                                uri=res.uri,
                                name=res.name,
                                description=res.description or "",
                                server=name,
                                mime_type=getattr(res, "mimeType", None),
                            )
                        )
            except Exception:
                continue
        return resources

    async def read_resource(self, server_name: str, uri: str) -> str:
        async with self._get_session(server_name) as session:
            result = await session.read_resource(uri)
            contents = getattr(result, "contents", None)
            if not contents:
                return str(result)
            parts: List[str] = []
            for item in contents:
                if hasattr(item, "text"):
                    parts.append(str(item.text))
                elif hasattr(item, "blob"):
                    parts.append(f"[Binary data: {len(item.blob)} bytes]")
            return "\n".join(parts)

