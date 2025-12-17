from __future__ import annotations

import os
import subprocess
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
import psutil
from fastapi import APIRouter, Depends, HTTPException, Request

from vllmstudio.backends import get_backend
from vllmstudio.metrics import MetricsState, parse_vllm_metrics

from ..deps import get_inference_port, get_settings, get_store, require_scope
from ..config import Settings
from ..stores import SQLiteRecipeStore


router = APIRouter(prefix="/v1", tags=["ops"])


def _bytes_to_gb(value: Optional[int]) -> Optional[float]:
    if value is None:
        return None
    return round(value / (1024**3), 3)


def _dir_size_bytes(path: Path, *, max_files: int = 200_000) -> Optional[int]:
    if not path.exists():
        return None
    if path.is_file():
        return path.stat().st_size
    total = 0
    seen = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            seen += 1
            if seen > max_files:
                return None
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                continue
    return total


def _gpu_info() -> Dict[str, Any]:
    if not shutil.which("nvidia-smi"):
        return {"gpus": [], "detail": "nvidia-smi not found"}
    try:
        out = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=index,name,memory.total,memory.free,driver_version",
                "--format=csv,noheader,nounits",
            ],
            text=True,
            timeout=2,
        )
        gpus = []
        for line in out.splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 5:
                continue
            idx, name, total_mb, free_mb, driver = parts[:5]
            gpus.append(
                {
                    "index": int(idx),
                    "name": name,
                    "memory_total_gb": round(float(total_mb) / 1024.0, 3),
                    "memory_free_gb": round(float(free_mb) / 1024.0, 3),
                    "driver_version": driver,
                }
            )
        return {"gpus": gpus}
    except Exception as e:
        return {"gpus": [], "detail": str(e)}


@router.get("/system/resources")
async def system_resources(_p=Depends(require_scope("inference:read"))):
    vm = psutil.virtual_memory()
    sm = psutil.swap_memory()
    gpu = _gpu_info()
    return {
        "ram_total_gb": _bytes_to_gb(vm.total),
        "ram_available_gb": _bytes_to_gb(vm.available),
        "ram_used_gb": _bytes_to_gb(vm.used),
        "swap_total_gb": _bytes_to_gb(sm.total),
        "swap_used_gb": _bytes_to_gb(sm.used),
        "cpu_count_logical": psutil.cpu_count(logical=True),
        "cpu_count_physical": psutil.cpu_count(logical=False),
        "gpus": gpu.get("gpus", []),
        "gpu_detail": gpu.get("detail"),
    }


@router.get("/recipes/{recipe_id}/estimate")
async def recipe_estimate(
    recipe_id: str,
    _p=Depends(require_scope("recipes:read")),
    store: SQLiteRecipeStore = Depends(get_store),
):
    record = store.get_record(recipe_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe = record.recipe

    weights_bytes = _dir_size_bytes(Path(recipe.model_path))
    weights_gb = _bytes_to_gb(weights_bytes) if weights_bytes is not None else None

    kv_cache_dtype = (recipe.kv_cache_dtype or "auto").lower()
    kv_multiplier = 1.0
    if kv_cache_dtype.startswith("fp8"):
        kv_multiplier = 0.5

    kv_cache_200k_gb = round(weights_gb * kv_multiplier, 3) if weights_gb is not None else None
    total_200k_gb = round(weights_gb + kv_cache_200k_gb, 3) if weights_gb is not None and kv_cache_200k_gb is not None else None

    return {
        "recipe_id": recipe.id,
        "model_key": record.model_key,
        "model_path": recipe.model_path,
        "quantization": recipe.quantization,
        "dtype": recipe.dtype,
        "kv_cache_dtype": recipe.kv_cache_dtype,
        "weights_bytes": weights_bytes,
        "weights_gb": weights_gb,
        "estimate": {
            "kv_cache_200k_gb": kv_cache_200k_gb,
            "total_vram_200k_gb": total_200k_gb,
            "assumptions": [
                "KV cache at ~200k context is approximated as ~= model weights (heuristic).",
                "If kv_cache_dtype starts with fp8, KV estimate is halved.",
                "Weights size only computed for local filesystem paths; remote HF repos return null.",
            ],
        },
    }


@router.get("/runs/logs")
async def run_logs(
    request: Request,
    _p=Depends(require_scope("inference:read")),
    tail_bytes: int = 50_000,
    store: SQLiteRecipeStore = Depends(get_store),
):
    recipe_id = getattr(request.app.state, "current_recipe_id", None)
    if not recipe_id:
        raise HTTPException(status_code=404, detail="No active recipe")
    record = store.get_record(recipe_id)
    if not record:
        raise HTTPException(status_code=404, detail="Active recipe not found")
    backend = get_backend(record.recipe.backend)
    log_path = backend.default_log_file(record.recipe.id)
    path = Path(log_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Log file not found: {log_path}")
    data = path.read_bytes()[-max(0, tail_bytes) :] if tail_bytes else path.read_bytes()
    return {"recipe_id": recipe_id, "log_file": str(path), "tail_bytes": len(data), "content": data.decode("utf-8", errors="ignore")}


@router.get("/metrics/vllm")
async def vllm_metrics(
    request: Request,
    _p=Depends(require_scope("inference:read")),
    inference_port: int = Depends(get_inference_port),
    cfg: Settings = Depends(get_settings),
):
    state: Optional[MetricsState] = getattr(request.app.state, "metrics_state", None)
    if state is None:
        state = MetricsState()
        request.app.state.metrics_state = state

    max_state: Dict[str, float] = getattr(request.app.state, "metrics_max", None)
    if max_state is None:
        max_state = {"prompt_tps": 0.0, "gen_tps": 0.0}
        request.app.state.metrics_max = max_state

    async with httpx.AsyncClient(timeout=3.0) as client:
        resp = await client.get(f"http://{cfg.inference_host}:{inference_port}/metrics")
        resp.raise_for_status()
        text = resp.text

    parsed = parse_vllm_metrics(text, state)
    prompt_tps = float(parsed.get("prompt_throughput") or 0.0)
    gen_tps = float(parsed.get("generation_throughput") or 0.0)
    if prompt_tps > max_state["prompt_tps"]:
        max_state["prompt_tps"] = prompt_tps
    if gen_tps > max_state["gen_tps"]:
        max_state["gen_tps"] = gen_tps

    parsed["max_prompt_throughput"] = round(max_state["prompt_tps"], 2)
    parsed["max_generation_throughput"] = round(max_state["gen_tps"], 2)
    return parsed
