"""MCP Server Manager for connecting to external tool servers."""
import asyncio
import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
import logging

from ..tools.registry import Tool, ToolParameter, ToolType, get_registry

logger = logging.getLogger(__name__)


@dataclass
class MCPServer:
    """Configuration for an MCP server."""
    name: str
    command: str  # Command to start the server
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True
    description: str = ""
    
    # Runtime state
    process: Optional[subprocess.Popen] = field(default=None, repr=False)
    tools: List[Tool] = field(default_factory=list, repr=False)


class MCPManager:
    """Manager for MCP servers."""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.servers: Dict[str, MCPServer] = {}
        self.config_path = config_path or Path.home() / ".vllmstudio" / "mcp_servers.json"
        self._load_config()
    
    def _load_config(self) -> None:
        """Load MCP server configurations."""
        if self.config_path.exists():
            try:
                data = json.loads(self.config_path.read_text())
                for name, config in data.get("servers", {}).items():
                    self.servers[name] = MCPServer(
                        name=name,
                        command=config["command"],
                        args=config.get("args", []),
                        env=config.get("env", {}),
                        enabled=config.get("enabled", True),
                        description=config.get("description", ""),
                    )
            except Exception as e:
                logger.error(f"Failed to load MCP config: {e}")
    
    def _save_config(self) -> None:
        """Save MCP server configurations."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "servers": {
                name: {
                    "command": server.command,
                    "args": server.args,
                    "env": server.env,
                    "enabled": server.enabled,
                    "description": server.description,
                }
                for name, server in self.servers.items()
            }
        }
        self.config_path.write_text(json.dumps(data, indent=2))
    
    def add_server(
        self,
        name: str,
        command: str,
        args: Optional[List[str]] = None,
        env: Optional[Dict[str, str]] = None,
        description: str = "",
    ) -> MCPServer:
        """Add a new MCP server configuration."""
        server = MCPServer(
            name=name,
            command=command,
            args=args or [],
            env=env or {},
            description=description,
        )
        self.servers[name] = server
        self._save_config()
        return server
    
    def remove_server(self, name: str) -> bool:
        """Remove an MCP server."""
        if name in self.servers:
            # Stop if running
            if self.servers[name].process:
                self.stop_server(name)
            del self.servers[name]
            self._save_config()
            return True
        return False
    
    def enable_server(self, name: str) -> bool:
        """Enable an MCP server."""
        if name in self.servers:
            self.servers[name].enabled = True
            self._save_config()
            return True
        return False
    
    def disable_server(self, name: str) -> bool:
        """Disable an MCP server."""
        if name in self.servers:
            self.servers[name].enabled = False
            if self.servers[name].process:
                self.stop_server(name)
            self._save_config()
            return True
        return False
    
    async def start_server(self, name: str) -> bool:
        """Start an MCP server and discover its tools."""
        server = self.servers.get(name)
        if not server or not server.enabled:
            return False
        
        if server.process and server.process.poll() is None:
            return True  # Already running
        
        try:
            # Start the server process
            import os
            env = os.environ.copy()
            env.update(server.env)
            
            server.process = subprocess.Popen(
                [server.command] + server.args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
            
            # TODO: Implement MCP protocol handshake and tool discovery
            # For now, we'll just mark it as started
            logger.info(f"Started MCP server: {name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start MCP server {name}: {e}")
            return False
    
    def stop_server(self, name: str) -> bool:
        """Stop an MCP server."""
        server = self.servers.get(name)
        if not server or not server.process:
            return False
        
        try:
            server.process.terminate()
            server.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.process.kill()
        
        server.process = None
        
        # Unregister tools from this server
        registry = get_registry()
        for tool in server.tools:
            registry.unregister(tool.name)
        server.tools = []
        
        logger.info(f"Stopped MCP server: {name}")
        return True
    
    def list_servers(self) -> List[Dict[str, Any]]:
        """List all MCP servers and their status."""
        return [
            {
                "name": server.name,
                "command": server.command,
                "enabled": server.enabled,
                "running": server.process is not None and server.process.poll() is None,
                "description": server.description,
                "tools_count": len(server.tools),
            }
            for server in self.servers.values()
        ]
    
    async def call_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on an MCP server."""
        server = self.servers.get(server_name)
        if not server or not server.process:
            return {"error": f"Server {server_name} not running"}
        
        # TODO: Implement MCP protocol tool call
        return {"error": "MCP tool calling not yet implemented"}


# Global manager instance
_manager: Optional[MCPManager] = None


def get_mcp_manager() -> MCPManager:
    """Get the global MCP manager."""
    global _manager
    if _manager is None:
        _manager = MCPManager()
    return _manager
