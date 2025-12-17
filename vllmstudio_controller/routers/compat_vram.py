from __future__ import annotations

import json as json_lib
from pathlib import Path
from typing import Any, Dict, List, Optional

import subprocess
import xml.etree.ElementTree as ET
from fastapi import APIRouter, Depends, HTTPException

from ..deps import require_scope


router = APIRouter(tags=["compat"])


def _detect_quantization(name_lower: str, requested: str) -> str:
    if requested != "auto":
        return requested
    if "awq" in name_lower or "int4" in name_lower or "w4a16" in name_lower:
        return "int4"
    if "gptq" in name_lower:
        return "gptq"
    if "int8" in name_lower or "w8a8" in name_lower:
        return "int8"
    if "fp8" in name_lower:
        return "fp8"
    return "fp16"


def _weights_size_gb(model_dir: Path) -> Optional[float]:
    try:
        model_files = list(model_dir.glob("*.safetensors")) + list(model_dir.glob("*.bin"))
        if model_files:
            total = sum(f.stat().st_size for f in model_files if f.is_file())
        else:
            total = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file())
        return round(total / (1024**3), 2)
    except Exception:
        return None


def _gpu_memory_total_gb() -> float:
    try:
        result = subprocess.run(["nvidia-smi", "-q", "-x"], capture_output=True, text=True, timeout=5, check=False)
        if result.returncode != 0:
            return 24.0
        root = ET.fromstring(result.stdout)
        gpu = root.find("gpu")
        if gpu is None:
            return 24.0
        total = gpu.findtext("fb_memory_usage/total")
        if not total:
            return 24.0
        mb = int(total.replace(" MiB", "").strip())
        return float(mb) / 1024.0
    except Exception:
        return 24.0


@router.get("/vram-calculator")
async def vram_calculator(
    model_path: Optional[str] = None,
    context_length: int = 32768,
    batch_size: int = 12,
    tp_size: int = 1,
    quantization: str = "auto",
    kv_cache_dtype: str = "fp16",
    _p=Depends(require_scope("recipes:read")),
):
    if not model_path:
        raise HTTPException(status_code=400, detail="model_path required")

    model_dir = Path(model_path)
    if not model_dir.exists():
        raise HTTPException(status_code=404, detail=f"Model path not found: {model_path}")

    config_path = model_dir / "config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="No config.json found in model directory")

    with open(config_path) as f:
        config = json_lib.load(f)

    hidden_size = int(config.get("hidden_size") or 4096)
    num_layers = int(config.get("num_hidden_layers") or 32)
    num_heads = int(config.get("num_attention_heads") or 32)
    num_kv_heads = int(config.get("num_key_value_heads") or num_heads)
    head_dim = int(config.get("head_dim") or max(1, hidden_size // max(num_heads, 1)))

    name_lower = model_dir.name.lower()
    quantization = _detect_quantization(name_lower, quantization)
    kv_cache_dtype = (kv_cache_dtype or "fp16").lower()
    if kv_cache_dtype == "auto":
        kv_cache_dtype = "fp16"

    weights_gb = _weights_size_gb(model_dir) or 0.0

    kv_bytes_per_element = 1 if kv_cache_dtype.startswith("fp8") else 2
    kv_bytes_per_token = 2 * num_layers * num_kv_heads * head_dim * kv_bytes_per_element
    kv_cache_gb = (kv_bytes_per_token * int(context_length) * int(batch_size)) / (1024**3)

    activations_gb = (hidden_size * int(batch_size) * 4 * 2) / (1024**3)
    overhead_gb = 1.5 + (0.2 * max(int(tp_size), 1))

    total_gb = float(weights_gb) + float(kv_cache_gb) + float(activations_gb) + float(overhead_gb)
    per_gpu_gb = total_gb / max(int(tp_size), 1)

    memory_per_gpu_gb = _gpu_memory_total_gb()
    num_gpus = max(1, int(tp_size))
    total_available_gb = memory_per_gpu_gb * num_gpus
    fits = per_gpu_gb < (memory_per_gpu_gb * 0.95)
    utilization_pct = (per_gpu_gb / max(memory_per_gpu_gb, 1e-6)) * 100.0

    recommendations: List[str] = []
    if not fits:
        if kv_cache_dtype == "fp16":
            recommendations.append("Try fp8 KV cache (kv_cache_dtype=fp8)")
        if context_length > 32768:
            recommendations.append("Reduce context length")
        if batch_size > 8:
            recommendations.append("Reduce batch size / max_num_seqs")
        if tp_size < 8:
            recommendations.append("Increase tensor parallelism (tp)")
    else:
        recommendations.append("Config looks plausible; expect real usage to vary by model/kernel.")

    context_configs: List[Dict[str, Any]] = []
    for ctx in [8192, 16384, 32768, 65536, 131072, 200000]:
        kv_gb = (kv_bytes_per_token * int(ctx) * int(batch_size)) / (1024**3)
        tot = float(weights_gb) + float(kv_gb) + float(activations_gb) + float(overhead_gb)
        per = tot / max(int(tp_size), 1)
        ok = per < (memory_per_gpu_gb * 0.95)
        context_configs.append(
            {
                "context_length": int(ctx),
                "kv_cache_gb": float(kv_gb),
                "total_gb": float(tot),
                "per_gpu_gb": float(per),
                "fits": bool(ok),
                "utilization_pct": (per / max(memory_per_gpu_gb, 1e-6)) * 100.0,
            }
        )

    return {
        "model_path": str(model_dir),
        "quantization": quantization,
        "kv_cache_dtype": kv_cache_dtype,
        "context_length": int(context_length),
        "batch_size": int(batch_size),
        "tp_size": int(tp_size),
        "breakdown": {
            "model_weights_gb": float(weights_gb),
            "kv_cache_gb": float(kv_cache_gb),
            "activations_gb": float(activations_gb),
            "overhead_gb": float(overhead_gb),
            "total_gb": float(total_gb),
            "per_gpu_gb": float(per_gpu_gb),
        },
        "gpu_info": {
            "num_gpus": int(num_gpus),
            "memory_per_gpu_gb": float(memory_per_gpu_gb),
            "total_available_gb": float(total_available_gb),
        },
        "fits": bool(fits),
        "utilization_percent": float(utilization_pct),
        "recommendations": recommendations,
        "context_configs": context_configs,
    }

