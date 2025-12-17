from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from ..config import Settings
from ..deps import get_settings, require_scope
from ..services.mcp import MCPManager, MCPServer


router = APIRouter(tags=["compat"])


@router.get("/mcp/servers")
async def list_servers(
    _p=Depends(require_scope("mcp:read")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    return {"servers": mgr.list_servers()}


@router.post("/mcp/servers")
async def add_server(
    payload: Dict[str, Any],
    _p=Depends(require_scope("mcp:write")),
    cfg: Settings = Depends(get_settings),
):
    name = str(payload.get("name") or "").strip()
    command = str(payload.get("command") or "").strip()
    if not name or not command:
        raise HTTPException(status_code=400, detail="name and command required")
    args = payload.get("args") or []
    env = payload.get("env") or {}
    mgr = MCPManager(cfg.mcp_config_path)
    if name in mgr.servers:
        raise HTTPException(status_code=409, detail="Server already exists")
    mgr.add_or_replace(
        MCPServer(
            name=name,
            command=command,
            args=[str(a) for a in args] if isinstance(args, list) else [],
            env={str(k): str(v) for k, v in env.items()} if isinstance(env, dict) else {},
            enabled=True,
        )
    )
    return {"status": "added", "server": name}


@router.put("/mcp/servers/{name}")
async def update_server(
    name: str,
    payload: Dict[str, Any],
    _p=Depends(require_scope("mcp:write")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    existing = mgr.servers.get(name)
    if not existing:
        raise HTTPException(status_code=404, detail="Server not found")

    mgr.add_or_replace(
        MCPServer(
            name=name,
            command=str(payload.get("command") or existing.command),
            args=[str(a) for a in payload.get("args")] if isinstance(payload.get("args"), list) else existing.args,
            env={str(k): str(v) for k, v in payload.get("env").items()} if isinstance(payload.get("env"), dict) else existing.env,
            enabled=bool(payload.get("enabled")) if "enabled" in payload else existing.enabled,
        )
    )
    return {"status": "updated", "server": name}


@router.delete("/mcp/servers/{name}")
async def delete_server(
    name: str,
    _p=Depends(require_scope("mcp:write")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    if name not in mgr.servers:
        raise HTTPException(status_code=404, detail="Server not found")
    mgr.remove(name)
    return {"status": "deleted", "server": name}


@router.get("/mcp/tools")
async def list_tools(
    server: Optional[str] = None,
    _p=Depends(require_scope("mcp:read")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    try:
        tools = await mgr.list_tools(server)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "server": t.server,
                "input_schema": t.input_schema,
            }
            for t in tools
        ]
    }


@router.post("/mcp/tools/{server}/{tool_name}")
async def run_tool(
    server: str,
    tool_name: str,
    payload: Dict[str, Any],
    _p=Depends(require_scope("mcp:write")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    try:
        result = await mgr.call_tool(server, tool_name, payload or {})
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"result": result}


@router.get("/mcp/resources")
async def list_resources(
    server: Optional[str] = None,
    _p=Depends(require_scope("mcp:read")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    try:
        resources = await mgr.list_resources(server)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {
        "resources": [
            {
                "uri": r.uri,
                "name": r.name,
                "description": r.description,
                "server": r.server,
                "mime_type": r.mime_type,
            }
            for r in resources
        ]
    }


@router.get("/mcp/resources/{server}")
async def read_resource(
    server: str,
    uri: str,
    _p=Depends(require_scope("mcp:read")),
    cfg: Settings = Depends(get_settings),
):
    mgr = MCPManager(cfg.mcp_config_path)
    try:
        content = await mgr.read_resource(server, uri)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"content": content}
