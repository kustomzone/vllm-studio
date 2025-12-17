from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..deps import require_scope


router = APIRouter(tags=["compat"])


LOG_DIRS = [Path("/tmp"), Path(__file__).resolve().parent.parent.parent / "logs"]


def _safe_tail_lines(path: Path, lines: int) -> list[str]:
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()
        recent = all_lines[-lines:] if lines > 0 and len(all_lines) > lines else all_lines
        return [l.rstrip("\n") for l in recent if l is not None]
    except Exception:
        return []


def find_log_file(recipe_id: str) -> Optional[Path]:
    port_suffix_match = re.match(r"^(.+)-(\d{4})$", recipe_id)
    base_id = port_suffix_match.group(1) if port_suffix_match else recipe_id

    patterns: list[Path] = [
        Path(f"/tmp/vllm_{recipe_id}.log"),
        Path(f"/tmp/{recipe_id}.log"),
    ]
    for port in ["8000", "3000", "8080", "8001"]:
        patterns.append(Path(f"/tmp/vllm_{base_id}-{port}.log"))
        patterns.append(Path(f"/tmp/{base_id}-{port}.log"))
    patterns.append(Path(f"/tmp/vllm_{base_id}.log"))
    patterns.append(Path(f"/tmp/{base_id}.log"))

    existing = [p for p in patterns if p.exists()]
    if existing:
        return max(existing, key=lambda p: p.stat().st_mtime)

    for root in LOG_DIRS:
        if not root.exists():
            continue
        matches = list(root.glob(f"*{recipe_id}*.log")) + list(root.glob(f"*{base_id}*.log"))
        matches = [m for m in matches if m.is_file()]
        if matches:
            return max(matches, key=lambda p: p.stat().st_mtime)

    for lf in Path("/tmp").glob("*.log"):
        if base_id in lf.name:
            return lf
    return None


@router.get("/logs")
async def list_logs(_p=Depends(require_scope("inference:read"))):
    logs = []
    for p in sorted(Path("/tmp").glob("*.log"), key=lambda x: x.stat().st_mtime, reverse=True):
        if not p.is_file():
            continue
        rid = p.name
        if rid.startswith("vllm_") and rid.endswith(".log"):
            rid = rid[len("vllm_") : -len(".log")]
        else:
            rid = rid[:-len(".log")]
        st = p.stat()
        logs.append({"name": p.name, "recipe_id": rid, "size": st.st_size, "modified": int(st.st_mtime), "path": str(p)})
        if len(logs) >= 200:
            break
    return {"logs": logs}


@router.get("/logs/{recipe_id}")
async def get_logs(recipe_id: str, lines: int = 100, _p=Depends(require_scope("inference:read"))):
    log_file = find_log_file(recipe_id)
    if not log_file:
        return {"logs": [], "file": None, "message": f"No log file found for {recipe_id}"}
    return {"logs": _safe_tail_lines(log_file, lines), "file": str(log_file)}


@router.delete("/logs/{recipe_id}")
async def delete_logs(recipe_id: str, _p=Depends(require_scope("inference:write"))):
    log_file = find_log_file(recipe_id)
    if not log_file:
        raise HTTPException(status_code=404, detail=f"No log file found for {recipe_id}")

    resolved = log_file.resolve()
    allowed_roots = [p.resolve() for p in LOG_DIRS if p.exists()] + [Path("/tmp").resolve()]
    is_allowed = any(str(resolved).startswith(str(root) + "/") or resolved == root for root in allowed_roots)
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Refusing to delete logs outside allowed directories")

    resolved.unlink(missing_ok=True)
    return {"status": "deleted", "file": str(resolved)}


@router.get("/logs/live/{recipe_id}")
async def live_logs(recipe_id: str, lines: int = 200, _p=Depends(require_scope("inference:read"))):
    log_file = find_log_file(recipe_id)
    if not log_file or not log_file.exists():
        raise HTTPException(status_code=404, detail="Log file not found")

    async def stream():
        # send initial tail
        for line in _safe_tail_lines(log_file, lines):
            yield f"data: {line}\n\n"

        last_size = log_file.stat().st_size
        while True:
            try:
                await asyncio.sleep(0.5)
                if not log_file.exists():
                    return
                current_size = log_file.stat().st_size
                if current_size < last_size:
                    last_size = 0
                if current_size == last_size:
                    continue
                with log_file.open("r", encoding="utf-8", errors="ignore") as f:
                    f.seek(last_size)
                    data = f.read()
                last_size = current_size
                for line in data.splitlines():
                    if line.strip():
                        yield f"data: {line}\n\n"
            except asyncio.CancelledError:
                return
            except Exception:
                await asyncio.sleep(1.0)

    return StreamingResponse(stream(), media_type="text/event-stream")

