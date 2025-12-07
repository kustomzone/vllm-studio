"""FastAPI application for vLLM Studio."""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import settings
from .models import (
    Recipe, RecipeWithStatus, RecipeStatus, ModelInfo, ProcessInfo,
    SwitchRequest, SwitchResponse, HealthResponse, Backend
)
from .process_manager import ProcessManager
from .recipe_manager import RecipeManager
from .model_indexer import ModelIndexer

# Static files path
STATIC_DIR = Path(__file__).parent.parent / "static"


# Global managers
recipe_manager: Optional[RecipeManager] = None
model_indexer: Optional[ModelIndexer] = None
switching_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global recipe_manager, model_indexer

    recipe_manager = RecipeManager()
    model_indexer = ModelIndexer()

    # Detect currently running model on startup
    current = ProcessManager.get_current_process(settings.vllm_port)
    if current:
        print(f"Detected running model: {current.model_path} (PID: {current.pid})")

        # Check if we have a recipe for it
        recipe = recipe_manager.find_recipe_for_model(current.model_path)
        if recipe:
            print(f"Matched to recipe: {recipe.id}")
        else:
            print("No matching recipe found")

    yield


app = FastAPI(
    title="vLLM Studio",
    description="Model management for vLLM and SGLang",
    version=__version__,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health & Status
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    current = ProcessManager.get_current_process(settings.vllm_port)
    running_model = current.model_path if current else None

    # Check backend reachability
    backend_reachable = False
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:{settings.vllm_port}/health",
                timeout=2.0
            )
            backend_reachable = response.status_code == 200
    except:
        pass

    # Check proxy reachability
    proxy_reachable = False
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://{settings.proxy_host}:{settings.proxy_port}/health",
                timeout=2.0
            )
            proxy_reachable = response.status_code == 200
    except:
        pass

    return HealthResponse(
        status="ok",
        version=__version__,
        running_model=running_model,
        backend_reachable=backend_reachable,
        proxy_reachable=proxy_reachable
    )


@app.get("/status")
async def get_status():
    """Get detailed system status."""
    current = ProcessManager.get_current_process(settings.vllm_port)

    recipe = None
    if current:
        recipe = recipe_manager.find_recipe_for_model(current.model_path)

    return {
        "running_process": current.model_dump() if current else None,
        "matched_recipe": recipe.model_dump() if recipe else None,
        "vllm_port": settings.vllm_port,
        "proxy_port": settings.proxy_port,
        "recipes_count": len(recipe_manager.list_recipes()),
    }


# =============================================================================
# Recipes
# =============================================================================

@app.get("/recipes", response_model=list[RecipeWithStatus])
async def list_recipes():
    """List all recipes with their status."""
    return recipe_manager.get_recipes_with_status(settings.vllm_port)


@app.get("/recipes/{recipe_id}", response_model=RecipeWithStatus)
async def get_recipe(recipe_id: str):
    """Get a specific recipe."""
    recipe = recipe_manager.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Get status
    current = ProcessManager.get_current_process(settings.vllm_port)
    status = RecipeStatus.STOPPED
    pid = None

    if current and current.model_path == recipe.model_path:
        status = RecipeStatus.RUNNING
        pid = current.pid

    return RecipeWithStatus(**recipe.model_dump(), status=status, pid=pid)


@app.post("/recipes", response_model=Recipe)
async def create_recipe(recipe: Recipe):
    """Create a new recipe."""
    existing = recipe_manager.get_recipe(recipe.id)
    if existing:
        raise HTTPException(status_code=409, detail="Recipe already exists")

    recipe_manager.save_recipe(recipe)
    return recipe


@app.put("/recipes/{recipe_id}", response_model=Recipe)
async def update_recipe(recipe_id: str, recipe: Recipe):
    """Update an existing recipe."""
    existing = recipe_manager.get_recipe(recipe_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe.id = recipe_id
    recipe_manager.save_recipe(recipe)
    return recipe


@app.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe."""
    if not recipe_manager.delete_recipe(recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"status": "deleted"}


# =============================================================================
# Model Management
# =============================================================================

@app.get("/models", response_model=list[ModelInfo])
async def list_models():
    """List all indexed models."""
    return model_indexer.scan_models()


@app.get("/models/running", response_model=Optional[ProcessInfo])
async def get_running_model():
    """Get information about the currently running model."""
    return ProcessManager.get_current_process(settings.vllm_port)


@app.get("/processes", response_model=list[ProcessInfo])
async def list_processes():
    """List all inference processes."""
    return ProcessManager.find_inference_processes()


# =============================================================================
# Model Switching
# =============================================================================

@app.post("/switch", response_model=SwitchResponse)
async def switch_model(request: SwitchRequest, background_tasks: BackgroundTasks):
    """Switch to a different model."""
    recipe = recipe_manager.get_recipe(request.recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Check if already running
    current = ProcessManager.get_current_process(settings.vllm_port)
    if current and current.model_path == recipe.model_path:
        return SwitchResponse(
            success=True,
            message="Model already running",
            new_recipe=recipe.id,
            pid=current.pid
        )

    # Acquire lock to prevent concurrent switches
    if switching_lock.locked():
        raise HTTPException(status_code=409, detail="Model switch already in progress")

    async with switching_lock:
        old_recipe = None
        old_model = None

        # Evict current model if running
        if current:
            old_model = current.model_path
            old_recipe_obj = recipe_manager.find_recipe_for_model(current.model_path)
            old_recipe = old_recipe_obj.id if old_recipe_obj else None

            success, _ = await ProcessManager.evict_current_model(
                port=settings.vllm_port,
                force=request.force
            )
            if not success:
                return SwitchResponse(
                    success=False,
                    message="Failed to evict current model",
                    old_recipe=old_recipe,
                    new_recipe=recipe.id
                )

        # Launch new model
        success, pid, message = await ProcessManager.launch_model(recipe)

        if not success:
            return SwitchResponse(
                success=False,
                message=f"Failed to launch model: {message}",
                old_recipe=old_recipe,
                new_recipe=recipe.id
            )

        return SwitchResponse(
            success=True,
            message="Model switch initiated",
            old_recipe=old_recipe,
            new_recipe=recipe.id,
            pid=pid
        )


@app.post("/evict")
async def evict_model(force: bool = False):
    """Evict the currently running model."""
    current = ProcessManager.get_current_process(settings.vllm_port)
    if not current:
        return {"status": "no_model_running"}

    success, old_model = await ProcessManager.evict_current_model(
        port=settings.vllm_port,
        force=force
    )

    if success:
        return {"status": "evicted", "model": old_model}
    else:
        raise HTTPException(status_code=500, detail="Failed to evict model")


@app.post("/launch/{recipe_id}", response_model=SwitchResponse)
async def launch_recipe(recipe_id: str, force: bool = False):
    """Launch a specific recipe (evicts current if needed)."""
    return await switch_model(SwitchRequest(recipe_id=recipe_id, force=force), BackgroundTasks())


@app.get("/wait-ready")
async def wait_for_ready(timeout: int = 300):
    """Wait for the current model to be ready."""
    ready = await ProcessManager.wait_for_model_ready(
        port=settings.vllm_port,
        timeout=timeout
    )
    if ready:
        return {"status": "ready"}
    else:
        raise HTTPException(status_code=504, detail="Timeout waiting for model")


# =============================================================================
# Proxy passthrough with auto-switching
# =============================================================================

async def _auto_switch_if_needed(body: bytes) -> bool:
    """Check if we need to switch models based on the request. Returns True if switched."""
    import json

    try:
        data = json.loads(body)
        requested_model = data.get("model")
        if not requested_model:
            return False

        # Get current running model
        current = ProcessManager.get_current_process(settings.vllm_port)
        if current and current.model_path == requested_model:
            return False  # Already running the right model

        # Find a recipe that matches this model
        recipe = recipe_manager.find_recipe_for_model(requested_model)
        if not recipe:
            # Try to find by recipe ID (in case model name is the recipe ID)
            recipe = recipe_manager.get_recipe(requested_model)

        if not recipe:
            return False  # No matching recipe, let vLLM handle the error

        # Check if this recipe's model is already running
        if current and current.model_path == recipe.model_path:
            return False

        # Need to switch! Acquire lock
        if switching_lock.locked():
            raise HTTPException(status_code=409, detail="Model switch already in progress")

        async with switching_lock:
            # Evict current model if running
            if current:
                await ProcessManager.evict_current_model(port=settings.vllm_port, force=True)

            # Launch new model
            success, pid, message = await ProcessManager.launch_model(recipe)
            if not success:
                raise HTTPException(status_code=500, detail=f"Failed to launch model: {message}")

            # Wait for model to be ready
            ready = await ProcessManager.wait_for_model_ready(port=settings.vllm_port, timeout=300)
            if not ready:
                raise HTTPException(status_code=504, detail="Model failed to become ready")

        return True
    except json.JSONDecodeError:
        return False
    except HTTPException:
        raise
    except Exception:
        return False


@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_to_backend(path: str, request: Request):
    """Proxy requests to the backend inference server. Auto-switches models if needed."""
    body = b""
    if request.method != "GET":
        body = await request.body()

        # Auto-switch models for chat/completions endpoints
        if path in ("chat/completions", "completions"):
            await _auto_switch_if_needed(body)

    async with httpx.AsyncClient() as client:
        url = f"http://localhost:{settings.vllm_port}/v1/{path}"

        try:
            if request.method == "GET":
                response = await client.get(url, timeout=120.0)
            else:
                response = await client.request(
                    method=request.method,
                    url=url,
                    content=body,
                    headers=dict(request.headers),
                    timeout=120.0
                )

            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type")
            )
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Backend not available")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Backend timeout")


# =============================================================================
# Logs
# =============================================================================

@app.get("/logs/{recipe_id}")
async def get_logs(recipe_id: str, lines: int = 100):
    """Get recent logs for a recipe."""
    log_file = Path(f"/tmp/vllm_{recipe_id}.log")
    if not log_file.exists():
        return {"logs": [], "file": str(log_file)}

    try:
        with open(log_file, 'r') as f:
            all_lines = f.readlines()
            recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {"logs": [line.rstrip() for line in recent], "file": str(log_file)}
    except Exception as e:
        return {"logs": [], "error": str(e)}


@app.get("/logs")
async def list_log_files():
    """List available log files."""
    log_dir = Path("/tmp")
    logs = list(log_dir.glob("vllm_*.log"))
    return {
        "logs": [
            {"name": log.name, "recipe_id": log.stem.replace("vllm_", ""), "size": log.stat().st_size}
            for log in logs
        ]
    }


# =============================================================================
# GPU Info
# =============================================================================

@app.get("/gpus")
async def get_gpu_info():
    """Get GPU status including memory and temperature."""
    import subprocess
    import xml.etree.ElementTree as ET

    try:
        result = subprocess.run(
            ["nvidia-smi", "-q", "-x"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return {"gpus": [], "error": "nvidia-smi failed"}

        root = ET.fromstring(result.stdout)
        gpus = []

        for gpu in root.findall("gpu"):
            gpu_info = {
                "id": len(gpus),
                "name": gpu.find("product_name").text if gpu.find("product_name") is not None else "Unknown",
                "uuid": gpu.find("uuid").text if gpu.find("uuid") is not None else None,
            }

            # Temperature
            temp_elem = gpu.find("temperature")
            if temp_elem is not None:
                temp_gpu = temp_elem.find("gpu_temp")
                if temp_gpu is not None and temp_gpu.text:
                    gpu_info["temp_c"] = int(temp_gpu.text.replace(" C", ""))

            # Memory
            mem_elem = gpu.find("fb_memory_usage")
            if mem_elem is not None:
                total = mem_elem.find("total")
                used = mem_elem.find("used")
                free = mem_elem.find("free")

                if total is not None and total.text:
                    gpu_info["memory_total_mb"] = int(total.text.replace(" MiB", ""))
                if used is not None and used.text:
                    gpu_info["memory_used_mb"] = int(used.text.replace(" MiB", ""))
                if free is not None and free.text:
                    gpu_info["memory_free_mb"] = int(free.text.replace(" MiB", ""))

            # Utilization
            util_elem = gpu.find("utilization")
            if util_elem is not None:
                gpu_util = util_elem.find("gpu_util")
                if gpu_util is not None and gpu_util.text:
                    gpu_info["utilization_pct"] = int(gpu_util.text.replace(" %", ""))

            # Power
            power_elem = gpu.find("gpu_power_readings")
            if power_elem is not None:
                power_draw = power_elem.find("power_draw")
                if power_draw is not None and power_draw.text:
                    try:
                        gpu_info["power_w"] = float(power_draw.text.replace(" W", ""))
                    except:
                        pass

            gpus.append(gpu_info)

        return {"gpus": gpus}
    except subprocess.TimeoutExpired:
        return {"gpus": [], "error": "nvidia-smi timeout"}
    except FileNotFoundError:
        return {"gpus": [], "error": "nvidia-smi not found"}
    except Exception as e:
        return {"gpus": [], "error": str(e)}


# =============================================================================
# Performance Metrics
# =============================================================================

@app.get("/metrics")
async def get_performance_metrics():
    """Get performance metrics from vLLM backend."""
    import re

    metrics = {
        "avg_prompt_throughput": None,
        "avg_generation_throughput": None,
        "running_requests": None,
        "pending_requests": None,
        "gpu_cache_usage": None,
        "cpu_cache_usage": None,
    }

    try:
        # Try to get metrics from vLLM's prometheus endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:{settings.vllm_port}/metrics",
                timeout=5.0
            )
            if response.status_code == 200:
                text = response.text

                # Parse prometheus metrics
                patterns = {
                    "avg_prompt_throughput": r'vllm:avg_prompt_throughput_toks_per_s\{[^}]*\}\s+([\d.]+)',
                    "avg_generation_throughput": r'vllm:avg_generation_throughput_toks_per_s\{[^}]*\}\s+([\d.]+)',
                    "running_requests": r'vllm:num_requests_running\{[^}]*\}\s+([\d.]+)',
                    "pending_requests": r'vllm:num_requests_waiting\{[^}]*\}\s+([\d.]+)',
                    "gpu_cache_usage": r'vllm:gpu_cache_usage_perc\{[^}]*\}\s+([\d.]+)',
                    "cpu_cache_usage": r'vllm:cpu_cache_usage_perc\{[^}]*\}\s+([\d.]+)',
                }

                for key, pattern in patterns.items():
                    match = re.search(pattern, text)
                    if match:
                        metrics[key] = float(match.group(1))

    except Exception as e:
        metrics["error"] = str(e)

    return metrics


# =============================================================================
# Web UI
# =============================================================================

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    """Serve the web UI."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return HTMLResponse("<h1>vLLM Studio</h1><p>UI not found. Check static/index.html</p>")


# Mount static files (must be after all other routes)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
