from __future__ import annotations

import json as json_lib
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException, Request

from vllmstudio.recipe_generator import generate_recipe_from_path

from ..config import Settings
from ..deps import get_inference_port, get_settings, get_store, require_scope
from ..services import find_current_inference_process
from ..stores import SQLiteRecipeStore


router = APIRouter(tags=["compat"])


def _safe_float_gb(value: int) -> float:
    return round(value / (1024**3), 3)


def _gpu_payload() -> list[dict]:
    try:
        result = subprocess.run(
            ["nvidia-smi", "-q", "-x"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if result.returncode != 0:
            return []
        root = ET.fromstring(result.stdout)
        out = []
        for gpu in root.findall("gpu"):
            mem = gpu.find("fb_memory_usage/total")
            mem_mb = None
            if mem is not None and mem.text:
                try:
                    mem_mb = int(mem.text.replace(" MiB", "").strip())
                except Exception:
                    mem_mb = None
            out.append({"memory_total_mb": mem_mb})
        return out
    except Exception:
        return []


@router.get("/models/running")
async def running_model(
    request: Request,
    _p=Depends(require_scope("inference:read")),
    inference_port: int = Depends(get_inference_port),
    store: SQLiteRecipeStore = Depends(get_store),
):
    current = find_current_inference_process(inference_port)
    if not current:
        return None

    backend = (current.backend or "vllm").lower()
    model_path = current.model_path or "unknown"
    served_model_name = getattr(current, "served_model_name", None)

    current_recipe_id = getattr(request.app.state, "current_recipe_id", None)
    if current_recipe_id:
        recipe = store.get(current_recipe_id)
        if recipe:
            backend = recipe.backend.value
            model_path = recipe.model_path
            served_model_name = served_model_name or recipe.served_model_name

    mem_gb = None
    try:
        proc = psutil.Process(current.pid)
        mem_gb = _safe_float_gb(int(proc.memory_info().rss))
    except Exception:
        mem_gb = None

    return {
        "pid": current.pid,
        "backend": backend,
        "model_path": model_path,
        "port": current.port,
        "cmdline": current.cmdline,
        "memory_gb": mem_gb or 0.0,
        "served_model_name": served_model_name,
    }


@router.get("/browser")
async def browse_models(
    path: Optional[str] = None,
    _p=Depends(require_scope("recipes:read")),
    cfg: Settings = Depends(get_settings),
    store: SQLiteRecipeStore = Depends(get_store),
):
    base_path = Path(path) if path else cfg.models_dir
    if not base_path.exists():
        return {"error": f"Path {base_path} does not exist", "models": []}

    recipes = store.list()
    recipe_paths = {r.model_path for r in recipes}
    models = []

    for item in base_path.iterdir():
        if not item.is_dir() or item.name.startswith("."):
            continue

        model_info: Dict[str, Any] = {
            "path": str(item),
            "name": item.name,
            "size_gb": None,
            "architecture": None,
            "quantization": None,
            "context_length": None,
            "num_params": None,
            "num_experts": None,
            "hidden_size": None,
            "num_layers": None,
            "vocab_size": None,
            "has_recipe": str(item) in recipe_paths,
        }

        config_path = item / "config.json"
        if config_path.exists():
            try:
                with open(config_path) as f:
                    config = json_lib.load(f)
                model_info["architecture"] = (config.get("architectures") or [None])[0]
                model_info["context_length"] = config.get("max_position_embeddings") or config.get("max_sequence_length")
                model_info["num_params"] = config.get("num_parameters")
                model_info["num_experts"] = config.get("num_experts") or config.get("num_local_experts")
                model_info["hidden_size"] = config.get("hidden_size")
                model_info["num_layers"] = config.get("num_hidden_layers")
                model_info["vocab_size"] = config.get("vocab_size")
            except Exception:
                pass

        name_lower = item.name.lower()
        if "awq" in name_lower:
            model_info["quantization"] = "AWQ"
        elif "gptq" in name_lower:
            model_info["quantization"] = "GPTQ"
        elif "exl3" in name_lower or "exl2" in name_lower:
            model_info["quantization"] = "EXL3" if "exl3" in name_lower else "EXL2"
        elif "fp8" in name_lower:
            model_info["quantization"] = "FP8"
        elif "int8" in name_lower:
            model_info["quantization"] = "INT8"
        elif "int4" in name_lower or "w4a16" in name_lower:
            model_info["quantization"] = "INT4"
        elif "gguf" in name_lower or any(f.suffix == ".gguf" for f in item.glob("*")):
            model_info["quantization"] = "GGUF"
        else:
            model_info["quantization"] = "FP16/BF16"

        try:
            total_size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
            model_info["size_gb"] = round(total_size / (1024**3), 2)
        except Exception:
            pass

        models.append(model_info)

    models.sort(key=lambda x: str(x.get("name", "")).lower())
    return {"path": str(base_path), "models": models, "count": len(models)}


@router.post("/generate-recipe")
async def generate_recipe(
    model_path: Optional[str] = None,
    name: Optional[str] = None,
    _p=Depends(require_scope("recipes:write")),
):
    if not model_path:
        raise HTTPException(status_code=400, detail="model_path required")
    recipe, analysis = generate_recipe_from_path(model_path, name, _gpu_payload())
    return {"recipe": recipe.model_dump(), "analysis": analysis}

