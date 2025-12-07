"""
vLLM Studio Router - Proxies requests to vLLM Studio API.
Provides recipe management, model switching, and log viewing.
"""

import httpx
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

# vLLM Studio API endpoint (configure via environment)
import os
VLLM_STUDIO_URL = os.getenv("VLLM_STUDIO_URL", "http://localhost:8080")


# ============================================
# Pydantic Models
# ============================================

class Recipe(BaseModel):
    id: str
    name: str
    model_path: str
    backend: str = "vllm"
    tensor_parallel_size: int = 1
    pipeline_parallel_size: int = 1
    max_model_len: int = 32768
    gpu_memory_utilization: float = 0.85
    kv_cache_dtype: str = "auto"
    tool_call_parser: Optional[str] = None
    quantization: Optional[str] = None


class SwitchRequest(BaseModel):
    recipe_id: str
    force: bool = False


# ============================================
# Health & Status
# ============================================

@router.get("/health")
async def vllm_studio_health():
    """Get vLLM Studio health status."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/health", timeout=5.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"vLLM Studio unavailable: {str(e)}")


@router.get("/status")
async def vllm_studio_status():
    """Get detailed vLLM Studio status."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/status", timeout=5.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


# ============================================
# Recipes
# ============================================

@router.get("/recipes")
async def list_recipes():
    """List all recipes with their status."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/recipes", timeout=10.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str):
    """Get a specific recipe."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/recipes/{recipe_id}", timeout=5.0)
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Recipe not found")
            return resp.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.post("/recipes")
async def create_recipe(recipe: Recipe):
    """Create a new recipe."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{VLLM_STUDIO_URL}/recipes",
                json=recipe.model_dump(),
                timeout=5.0
            )
            if resp.status_code == 409:
                raise HTTPException(status_code=409, detail="Recipe already exists")
            return resp.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, recipe: Recipe):
    """Update an existing recipe."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.put(
                f"{VLLM_STUDIO_URL}/recipes/{recipe_id}",
                json=recipe.model_dump(),
                timeout=5.0
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Recipe not found")
            return resp.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"{VLLM_STUDIO_URL}/recipes/{recipe_id}",
                timeout=5.0
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Recipe not found")
            return resp.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


# ============================================
# Model Management
# ============================================

@router.get("/models/running")
async def get_running_model():
    """Get the currently running model."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/models/running", timeout=5.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.post("/switch")
async def switch_model(request: SwitchRequest):
    """Switch to a different model."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{VLLM_STUDIO_URL}/switch",
                json=request.model_dump(),
                timeout=600.0  # Long timeout for model loading
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.post("/launch/{recipe_id}")
async def launch_recipe(recipe_id: str, force: bool = False):
    """Launch a specific recipe."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{VLLM_STUDIO_URL}/launch/{recipe_id}?force={force}",
                timeout=600.0
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.post("/evict")
async def evict_model(force: bool = False):
    """Evict the currently running model."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{VLLM_STUDIO_URL}/evict?force={force}",
                timeout=60.0
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.get("/wait-ready")
async def wait_for_ready(timeout: int = 300):
    """Wait for the current model to be ready."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{VLLM_STUDIO_URL}/wait-ready?timeout={timeout}",
                timeout=float(timeout + 10)
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


# ============================================
# Logs
# ============================================

@router.get("/logs")
async def list_log_files():
    """List available log files."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/logs", timeout=5.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@router.get("/logs/{recipe_id}")
async def get_logs(recipe_id: str, lines: int = 100):
    """Get recent logs for a recipe."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{VLLM_STUDIO_URL}/logs/{recipe_id}?lines={lines}",
                timeout=10.0
            )
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


# ============================================
# GPU Info
# ============================================

@router.get("/gpus")
async def get_gpu_info():
    """Get GPU status including memory and temperature."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/gpus", timeout=10.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


# ============================================
# Performance Metrics
# ============================================

@router.get("/metrics")
async def get_performance_metrics():
    """Get performance metrics from vLLM backend."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{VLLM_STUDIO_URL}/metrics", timeout=10.0)
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))
