from __future__ import annotations

import subprocess
import xml.etree.ElementTree as ET
from typing import Any, Dict

import httpx
from fastapi import APIRouter, Depends, Request

from vllmstudio.metrics import MetricsState, parse_vllm_metrics

from ..config import Settings
from ..deps import get_settings, require_scope


router = APIRouter(tags=["compat"])


@router.get("/gpus")
async def gpus(_p=Depends(require_scope("inference:read"))):
    """Frontend-compatible GPU status endpoint."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "-q", "-x"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if result.returncode != 0:
            return {"gpus": [], "error": "nvidia-smi failed"}

        root = ET.fromstring(result.stdout)
        gpus_out = []
        for gpu in root.findall("gpu"):
            info: Dict[str, Any] = {
                "id": len(gpus_out),
                "name": gpu.findtext("product_name") or "Unknown",
                "uuid": gpu.findtext("uuid"),
            }

            temp = gpu.find("temperature/gpu_temp")
            if temp is not None and temp.text:
                try:
                    info["temp_c"] = int(temp.text.replace(" C", "").strip())
                except Exception:
                    pass

            mem = gpu.find("fb_memory_usage")
            if mem is not None:
                total = mem.findtext("total")
                used = mem.findtext("used")
                free = mem.findtext("free")
                if total:
                    info["memory_total_mb"] = int(total.replace(" MiB", "").strip())
                if used:
                    info["memory_used_mb"] = int(used.replace(" MiB", "").strip())
                if free:
                    info["memory_free_mb"] = int(free.replace(" MiB", "").strip())

            util = gpu.find("utilization/gpu_util")
            if util is not None and util.text:
                try:
                    info["utilization_pct"] = int(util.text.replace(" %", "").strip())
                except Exception:
                    pass

            power = gpu.find("gpu_power_readings/power_draw")
            if power is not None and power.text:
                try:
                    info["power_w"] = float(power.text.replace(" W", "").strip())
                except Exception:
                    pass

            gpus_out.append(info)
        return {"gpus": gpus_out}
    except subprocess.TimeoutExpired:
        return {"gpus": [], "error": "nvidia-smi timeout"}
    except FileNotFoundError:
        return {"gpus": [], "error": "nvidia-smi not found"}
    except Exception as e:
        return {"gpus": [], "error": str(e)}


@router.get("/metrics")
async def metrics(
    request: Request,
    _p=Depends(require_scope("inference:read")),
    cfg: Settings = Depends(get_settings),
):
    """Frontend-compatible performance metrics endpoint."""
    base = {
        "running_requests": None,
        "pending_requests": None,
        "kv_cache_usage": None,
        "prefix_cache_hit_rate": None,
        "prompt_tokens_total": None,
        "generation_tokens_total": None,
        "prompt_throughput": None,
        "generation_throughput": None,
        "avg_ttft_ms": None,
        "avg_tpot_ms": None,
        "request_success": None,
        "error": None,
    }

    state: MetricsState | None = getattr(request.app.state, "metrics_state", None)
    if state is None:
        state = MetricsState()
        request.app.state.metrics_state = state

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://{cfg.inference_host}:{cfg.inference_port}/metrics")
        if resp.status_code == 200:
            base.update(parse_vllm_metrics(resp.text, state))
        else:
            base["error"] = f"Backend responded with {resp.status_code}"
    except Exception as e:
        base["error"] = str(e)

    return base

