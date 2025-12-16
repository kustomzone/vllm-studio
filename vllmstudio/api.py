"""FastAPI application for vLLM Studio."""

import asyncio
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, Any

import httpx
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware

from . import __version__
from .config import settings
from .models import (
    Recipe, RecipeWithStatus, RecipeStatus, ModelInfo, ProcessInfo,
    SwitchRequest, SwitchResponse, HealthResponse, Backend,
    TokenCountRequest, TokenCountResponse, UsageStats, UsageEntry
)
from .token_counter import TokenCounter, TokenUsage, usage_tracker
from .process_manager import ProcessManager
from .recipe_manager import RecipeManager
from .model_indexer import ModelIndexer
from .metrics import MetricsState, parse_vllm_metrics
from .recipe_generator import generate_recipe_from_path
from .chat_store import chat_store, ChatSession, ChatMessage


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


# Box tags pattern for GLM models - strip these from responses
BOX_TAGS_PATTERN = re.compile(r"<\|(?:begin|end)_of_box\|>")

def strip_box_tags(text: str) -> str:
    """Strip <|begin_of_box|> and <|end_of_box|> tags from content."""
    if not text:
        return text
    return BOX_TAGS_PATTERN.sub("", text)

app = FastAPI(
    title="vLLM Studio",
    description="Model management for vLLM and SGLang",
    version=__version__,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://app.homelabai.org",
        "http://app.homelabai.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# API Key Authentication (OpenAI-style Bearer token)
# =============================================================================

# Public endpoints that don't require auth
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/chats"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware for API key authentication (works like OpenAI)."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth if no API key configured
        if not settings.api_key:
            return await call_next(request)

        # Allow public endpoints (exact match or prefix for /chats, /mcp, /skills)
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith("/chats") or path.startswith("/mcp") or path.startswith("/skills"):
            return await call_next(request)

        # Check Authorization header (Bearer token)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Strip "Bearer "
            if token == settings.api_key:
                return await call_next(request)

        # Check X-API-Key header (alternative)
        api_key_header = request.headers.get("X-API-Key")
        if api_key_header == settings.api_key:
            return await call_next(request)

        # Unauthorized
        return JSONResponse(
            status_code=401,
            content={"error": {"message": "Invalid API key", "type": "invalid_api_key"}},
        )


# Add auth middleware
app.add_middleware(APIKeyMiddleware)


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
    def _matches_running(proc: Any, target: Recipe) -> bool:
        if not proc:
            return False
        # Backend must match (vllm vs sglang)
        try:
            if proc.backend.value != target.backend.value:
                return False
        except Exception:
            return False
        # Prefer served model name when available
        if target.served_model_name and getattr(proc, "served_model_name", None):
            return target.served_model_name == proc.served_model_name
        return proc.model_path == target.model_path

    if current and _matches_running(current, recipe):
        return SwitchResponse(
            success=True,
            message="Model already running",
            new_recipe=recipe.id,
            pid=current.pid
        )

    # If a switch is already in progress, return a non-error response so the UI can retry/poll.
    # (Raising 409 here is noisy and often triggered by auto-switching in parallel.)
    if switching_lock.locked():
        return SwitchResponse(
            success=False,
            message="Model switch already in progress",
            old_recipe=None,
            new_recipe=recipe.id,
            pid=None,
        )

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

        if current:
            # Check if already running the right model by:
            # 1. served_model_name match (e.g., "glm-4.6v-8bit")
            # 2. model_path match (e.g., "/mnt/llm_models/GLM-4.6V-AWQ-8bit")
            if current.served_model_name and current.served_model_name == requested_model:
                return False  # Already running - matched by served name
            if current.model_path == requested_model:
                return False  # Already running - matched by path

        # Find a recipe that matches this model
        recipe = None

        # 1. Try to find by recipe ID (most common - e.g., "glm-4.6v-8bit")
        recipe = recipe_manager.get_recipe(requested_model)

        # 2. Try to find by served_model_name
        if not recipe:
            for r in recipe_manager.list_recipes():
                if r.served_model_name == requested_model:
                    recipe = r
                    break

        # 3. Try to find by model_path
        if not recipe:
            recipe = recipe_manager.find_recipe_for_model(requested_model)

        if not recipe:
            return False  # No matching recipe, let vLLM handle the error

        # Check if this recipe's model is already running
        if current:
            # Match by model_path
            if current.model_path == recipe.model_path:
                return False  # Already running this recipe's model
            # Also match by served_model_name if both have it
            if recipe.served_model_name and current.served_model_name:
                if recipe.served_model_name == current.served_model_name:
                    return False  # Already running this recipe's model

        # Need to switch; if another switch is active, don't raise a hard error (let the request continue).
        if switching_lock.locked():
            return False

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
    except Exception as e:
        print(f"Auto-switch error: {e}")
        return False


# =============================================================================
# OpenAI-compatible /v1/models endpoint (returns ALL available recipes)
# =============================================================================

@app.get("/v1/models")
async def list_openai_models():
    """Return all available models (recipes) in OpenAI format."""
    import time

    recipes = recipe_manager.list_recipes()
    current = ProcessManager.get_current_process(settings.vllm_port)

    models = []
    for recipe in recipes:
        # Use served_model_name if set, otherwise recipe id
        model_id = recipe.served_model_name or recipe.id

        models.append({
            "id": model_id,
            "object": "model",
            "created": int(time.time()),
            "owned_by": "vllm-studio",
            "root": recipe.model_path,
            "parent": None,
            "max_model_len": recipe.max_model_len,
            "permission": [{
                "id": f"modelperm-{recipe.id}",
                "object": "model_permission",
                "created": int(time.time()),
                "allow_create_engine": False,
                "allow_sampling": True,
                "allow_logprobs": True,
                "allow_search_indices": False,
                "allow_view": True,
                "allow_fine_tuning": False,
                "organization": "*",
                "group": None,
                "is_blocking": False
            }]
        })

    return {"object": "list", "data": models}


# =============================================================================
# Token Counting & Usage Tracking (OpenAI/Claude-style)
# =============================================================================

@app.post("/v1/tokens/count", response_model=TokenCountResponse)
async def count_tokens(request: TokenCountRequest):
    """
    Count tokens in messages or text before sending to the model.

    Similar to Anthropic's token counting API - allows you to determine
    the total number of tokens in a Message prior to sending it.
    """
    breakdown = {}
    total = 0

    if request.text:
        # Count raw text tokens
        total = TokenCounter.count_tokens(request.text, request.model)
        breakdown["text"] = total
    elif request.messages:
        # Count message tokens
        message_tokens = TokenCounter.count_message_tokens(request.messages, request.model)
        breakdown["messages"] = message_tokens
        total = message_tokens

        if request.tools:
            tool_tokens = TokenCounter.count_tools_tokens(request.tools, request.model)
            breakdown["tools"] = tool_tokens
            total += tool_tokens

    return TokenCountResponse(num_tokens=total, breakdown=breakdown if len(breakdown) > 1 else None)


@app.post("/v1/chat/completions/tokenize")
async def tokenize_chat_request(request: dict):
    """
    Tokenize a chat completions request and return token counts.

    Accepts the same format as /v1/chat/completions but only returns
    token counts without making an inference request.
    """
    messages = request.get("messages", [])
    tools = request.get("tools")
    model = request.get("model", "default")

    message_tokens = TokenCounter.count_message_tokens(messages, model)
    result = {
        "input_tokens": message_tokens,
        "breakdown": {
            "messages": message_tokens
        }
    }

    if tools:
        tool_tokens = TokenCounter.count_tools_tokens(tools, model)
        result["breakdown"]["tools"] = tool_tokens
        result["input_tokens"] += tool_tokens

    return result


@app.get("/v1/usage", response_model=UsageStats)
async def get_usage_stats(window_seconds: int = None):
    """
    Get aggregated token usage statistics.

    Similar to OpenAI's usage API - returns aggregated token usage data.
    Optionally specify a time window in seconds to get recent stats.
    """
    stats = usage_tracker.get_stats(window_seconds)
    return stats


@app.get("/v1/usage/recent")
async def get_recent_usage(limit: int = 100):
    """
    Get recent usage log entries.

    Returns the most recent token usage entries with request details.
    """
    entries = usage_tracker.get_recent(limit)
    return {"entries": entries, "count": len(entries)}


@app.delete("/v1/usage")
async def clear_usage_stats():
    """Clear all usage tracking data."""
    usage_tracker.clear()
    return {"status": "cleared"}


@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_to_backend(path: str, request: Request):
    """Proxy requests to the backend inference server. Auto-switches models if needed."""
    import json
    import time
    import uuid

    body = b""
    is_streaming = False
    request_model = "unknown"
    request_id = f"req-{uuid.uuid4().hex[:12]}"
    start_time = time.perf_counter()

    if request.method != "GET":
        body = await request.body()

        # Check if this is a streaming request and extract model name
        try:
            data = json.loads(body)
            is_streaming = data.get("stream", False)
            request_model = data.get("model", "unknown")
        except:
            pass

        # Auto-switch models for chat/completions endpoints
        if path in ("chat/completions", "completions"):
            await _auto_switch_if_needed(body)

    url = f"http://localhost:{settings.vllm_port}/v1/{path}"
    is_completion_endpoint = path in ("chat/completions", "completions")

    try:
        if is_streaming:
            # For streaming requests, forward chunks and track usage from final chunk
            async def stream_response():
                nonlocal request_model
                usage_data = None
                chunk_buffer = []

                async with httpx.AsyncClient() as client:
                    async with client.stream(
                        method=request.method,
                        url=url,
                        content=body,
                        headers={k: v for k, v in request.headers.items() if k.lower() != 'host'},
                        timeout=300.0
                    ) as response:
                        async for chunk in response.aiter_bytes():
                            # Strip box tags from GLM model responses
                            chunk_str = chunk.decode("utf-8", errors="ignore")
                            chunk_str = strip_box_tags(chunk_str)
                            chunk = chunk_str.encode("utf-8")
                            yield chunk

                            # Try to extract usage from streaming chunks
                            if is_completion_endpoint:
                                try:
                                    chunk_str = chunk.decode('utf-8', errors='ignore')
                                    for line in chunk_str.split('\n'):
                                        if line.startswith('data: ') and '[DONE]' not in line:
                                            chunk_data = json.loads(line[6:])
                                            # Some backends send usage in final chunk
                                            if 'usage' in chunk_data:
                                                usage_data = chunk_data['usage']
                                            # Get model from response if not known
                                            if chunk_data.get('model'):
                                                request_model = chunk_data['model']
                                except:
                                    pass

                # Log usage after streaming completes
                if is_completion_endpoint and usage_data:
                    latency_ms = (time.perf_counter() - start_time) * 1000
                    usage = TokenUsage(
                        prompt_tokens=usage_data.get('prompt_tokens', 0),
                        completion_tokens=usage_data.get('completion_tokens', 0),
                        total_tokens=usage_data.get('total_tokens', 0)
                    )
                    usage_tracker.log_usage(
                        request_id=request_id,
                        model=request_model,
                        usage=usage,
                        latency_ms=latency_ms,
                        endpoint=f"/v1/{path}"
                    )

            return StreamingResponse(
                stream_response(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                }
            )
        else:
            # Non-streaming requests
            async with httpx.AsyncClient() as client:
                if request.method == "GET":
                    response = await client.get(url, timeout=120.0)
                else:
                    response = await client.request(
                        method=request.method,
                        url=url,
                        content=body,
                        headers={k: v for k, v in request.headers.items() if k.lower() != 'host'},
                        timeout=120.0
                    )

                # Extract and log usage from non-streaming completion responses
                if is_completion_endpoint and response.status_code == 200:
                    try:
                        response_data = json.loads(response.content)
                        usage_data = response_data.get('usage', {})
                        latency_ms = (time.perf_counter() - start_time) * 1000

                        # Get model from response
                        if response_data.get('model'):
                            request_model = response_data['model']

                        usage = TokenUsage(
                            prompt_tokens=usage_data.get('prompt_tokens', 0),
                            completion_tokens=usage_data.get('completion_tokens', 0),
                            total_tokens=usage_data.get('total_tokens', 0)
                        )
                        usage_tracker.log_usage(
                            request_id=request_id,
                            model=request_model,
                            usage=usage,
                            latency_ms=latency_ms,
                            endpoint=f"/v1/{path}"
                        )
                    except:
                        pass

                return StreamingResponse(
                    iter([response.content]),
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.headers.get("content-type")
                )
    except httpx.ConnectError:
        # Return OpenAI-compatible error format
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "message": "The model is not currently loaded. Please load a model first using the /switch endpoint or the vLLM Studio UI.",
                    "type": "service_unavailable",
                    "param": None,
                    "code": "model_not_loaded"
                }
            }
        )
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={
                "error": {
                    "message": "The request to the inference backend timed out.",
                    "type": "timeout_error",
                    "param": None,
                    "code": "backend_timeout"
                }
            }
        )


# =============================================================================
# Logs
# =============================================================================

# Log directories to search
LOG_DIRS = [
    Path("/tmp"),  # vLLM Studio managed logs
    Path(__file__).parent.parent / "logs",  # Local logs directory
]


def find_log_file(recipe_id: str) -> Optional[Path]:
    """Find log file for a recipe in multiple locations."""
    import re
    # Extract base ID (without port suffix like -3000, -8000)
    port_suffix_match = re.match(r'^(.+)-(\d{4})$', recipe_id)
    if port_suffix_match:
        base_id = port_suffix_match.group(1)
    else:
        base_id = recipe_id

    # Build list of patterns to check
    patterns_to_check = []

    # Check for the exact recipe_id
    patterns_to_check.append(f"/tmp/vllm_{recipe_id}.log")
    patterns_to_check.append(f"/tmp/{recipe_id}.log")

    # Check for base_id with common ports
    for port in ["8000", "3000", "8080"]:
        patterns_to_check.append(f"/tmp/vllm_{base_id}-{port}.log")
        patterns_to_check.append(f"/tmp/{base_id}-{port}.log")

    # Check for base_id without port
    patterns_to_check.append(f"/tmp/vllm_{base_id}.log")
    patterns_to_check.append(f"/tmp/{base_id}.log")

    # Find the most recently modified log file that exists
    existing_logs = []
    for pattern in patterns_to_check:
        path = Path(pattern)
        if path.exists():
            existing_logs.append(path)

    if existing_logs:
        # Return the most recently modified
        return max(existing_logs, key=lambda p: p.stat().st_mtime)

    # Check local logs directory
    local_logs = Path(__file__).parent.parent / "logs"
    if local_logs.exists():
        for pattern in [f"{recipe_id}.log", f"*{recipe_id}*.log", f"{base_id}.log", f"*{base_id}*.log"]:
            matches = list(local_logs.glob(pattern))
            if matches:
                return max(matches, key=lambda p: p.stat().st_mtime)

    # Fallback: find any log file containing the base_id
    matching_logs = []
    for log_file in Path("/tmp").glob("*.log"):
        if base_id in log_file.name:
            matching_logs.append(log_file)

    if matching_logs:
        return max(matching_logs, key=lambda p: p.stat().st_mtime)

    return None
@app.get("/logs/{recipe_id}")
async def get_logs(recipe_id: str, lines: int = 100):
    """Get recent logs for a recipe."""
    log_file = find_log_file(recipe_id)

    if not log_file:
        return {"logs": [], "file": None, "message": f"No log file found for {recipe_id}"}

    try:
        with open(log_file, 'r') as f:
            all_lines = f.readlines()
            recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {"logs": [line.rstrip() for line in recent], "file": str(log_file)}
    except Exception as e:
        return {"logs": [], "error": str(e)}


@app.delete("/logs/{recipe_id}")
async def delete_logs(recipe_id: str):
    """Delete a log file for a recipe id (only within known log directories)."""
    from fastapi import HTTPException

    log_file = find_log_file(recipe_id)
    if not log_file:
        raise HTTPException(status_code=404, detail=f"No log file found for {recipe_id}")

    try:
        resolved = log_file.resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log file path")

    allowed_roots = [p.resolve() for p in LOG_DIRS]
    local_logs = (Path(__file__).parent.parent / "logs")
    if local_logs.exists():
        allowed_roots.append(local_logs.resolve())

    is_allowed = any(str(resolved).startswith(str(root) + "/") or resolved == root for root in allowed_roots)
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Refusing to delete logs outside allowed directories")

    try:
        resolved.unlink(missing_ok=True)
        return {"status": "deleted", "file": str(resolved)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/logs")
async def list_log_files():
    """List available log files from all log directories."""
    logs = []
    seen_names = set()

    for log_dir in LOG_DIRS:
        if not log_dir.exists():
            continue

        # Get vLLM Studio managed logs
        for log in log_dir.glob("vllm_*.log"):
            if log.name not in seen_names:
                seen_names.add(log.name)
                logs.append({
                    "name": log.name,
                    "recipe_id": log.stem.replace("vllm_", ""),
                    "size": log.stat().st_size,
                    "modified": log.stat().st_mtime,
                    "path": str(log)
                })

        # Get other logs (local logs directory)
        if log_dir != Path("/tmp"):
            for log in log_dir.glob("*.log"):
                if log.name not in seen_names and not log.name.startswith("vllm_"):
                    seen_names.add(log.name)
                    logs.append({
                        "name": log.name,
                        "recipe_id": log.stem,
                        "size": log.stat().st_size,
                        "modified": log.stat().st_mtime,
                        "path": str(log)
                    })

    # Sort by modification time (newest first)
    logs.sort(key=lambda x: x.get("modified", 0), reverse=True)

    return {"logs": logs}


@app.get("/logs/live/{recipe_id}")
async def stream_logs(recipe_id: str, lines: int = 50):
    """Stream live logs for a recipe using Server-Sent Events."""
    import asyncio
    from sse_starlette.sse import EventSourceResponse

    log_file = find_log_file(recipe_id)

    async def log_generator():
        if not log_file or not log_file.exists():
            yield {"data": f"No log file found for {recipe_id}"}
            return

        # Send last N lines first
        try:
            with open(log_file, 'r') as f:
                all_lines = f.readlines()
                for line in all_lines[-lines:]:
                    yield {"data": line.rstrip()}
        except Exception as e:
            yield {"data": f"Error reading log: {e}"}
            return

        # Then tail the file
        last_size = log_file.stat().st_size
        while True:
            await asyncio.sleep(1)
            try:
                current_size = log_file.stat().st_size
                if current_size > last_size:
                    with open(log_file, 'r') as f:
                        f.seek(last_size)
                        new_content = f.read()
                        for line in new_content.splitlines():
                            if line.strip():
                                yield {"data": line}
                    last_size = current_size
            except Exception:
                break

    return EventSourceResponse(log_generator())


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
# Performance Metrics (Fixed for vLLM prometheus format)
# =============================================================================

# Global state for throughput calculation
_metrics_state = MetricsState()


@app.get("/metrics")
async def get_performance_metrics():
    """Get performance metrics from vLLM backend."""
    base_metrics = {
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

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:{settings.vllm_port}/metrics",
                timeout=5.0
            )
            if response.status_code == 200:
                parsed = parse_vllm_metrics(response.text, _metrics_state)
                base_metrics.update(parsed)
            else:
                base_metrics["error"] = f"Backend responded with {response.status_code}"
    except Exception as e:
        base_metrics["error"] = str(e)

    return base_metrics


# =============================================================================
# Model Browser (scan /mnt/llm_models for all models)
# =============================================================================

@app.get("/browser")
async def browse_models(path: str = None):
    """Browse models in the models directory with detailed info."""
    import json as json_lib
    from pathlib import Path

    base_path = Path(path) if path else settings.models_dir
    if not base_path.exists():
        return {"error": f"Path {base_path} does not exist", "models": []}

    models = []

    for item in base_path.iterdir():
        if not item.is_dir() or item.name.startswith('.'):
            continue

        model_info = {
            "path": str(item),
            "name": item.name,
            "size_gb": None,
            "architecture": None,
            "quantization": None,
            "context_length": None,
            "num_params": None,
            "num_experts": None,
            "has_recipe": recipe_manager.find_recipe_for_model(str(item)) is not None,
        }

        # Check for config.json
        config_path = item / "config.json"
        if config_path.exists():
            try:
                with open(config_path) as f:
                    config = json_lib.load(f)
                model_info["architecture"] = config.get("architectures", [None])[0]
                model_info["context_length"] = config.get("max_position_embeddings") or config.get("max_sequence_length")
                model_info["num_params"] = config.get("num_parameters")
                model_info["num_experts"] = config.get("num_experts") or config.get("num_local_experts")
                model_info["hidden_size"] = config.get("hidden_size")
                model_info["num_layers"] = config.get("num_hidden_layers")
                model_info["vocab_size"] = config.get("vocab_size")
            except:
                pass

        # Detect quantization from name and files
        name_lower = item.name.lower()
        if "awq" in name_lower or any(f.name.endswith('.safetensors') and 'awq' in f.name.lower() for f in item.glob('*')):
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
        elif "gguf" in name_lower or any(f.suffix == '.gguf' for f in item.glob('*')):
            model_info["quantization"] = "GGUF"
        else:
            model_info["quantization"] = "FP16/BF16"

        # Calculate size
        try:
            total_size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())
            model_info["size_gb"] = round(total_size / (1024**3), 2)
        except:
            pass

        models.append(model_info)

    # Sort by name
    models.sort(key=lambda x: x["name"].lower())
    return {"path": str(base_path), "models": models, "count": len(models)}


# =============================================================================
# Recipe Sharing & Export
# =============================================================================

@app.get("/recipes/{recipe_id}/export")
async def export_recipe(recipe_id: str, format: str = "json"):
    """Export a recipe as JSON or YAML."""
    import yaml

    recipe = recipe_manager.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    data = recipe.model_dump()

    if format.lower() == "yaml":
        content = yaml.dump(data, default_flow_style=False, sort_keys=False)
        return {"format": "yaml", "content": content, "recipe_id": recipe_id}
    else:
        return {"format": "json", "content": data, "recipe_id": recipe_id}


@app.post("/recipes/import")
async def import_recipe(data: dict, format: str = "json"):
    """Import a recipe from JSON or YAML content."""
    import yaml

    try:
        if format.lower() == "yaml" and isinstance(data.get("content"), str):
            recipe_data = yaml.safe_load(data["content"])
        else:
            recipe_data = data.get("content", data)

        # Validate and create recipe
        recipe = Recipe(**recipe_data)

        # Check if exists
        existing = recipe_manager.get_recipe(recipe.id)
        if existing:
            raise HTTPException(status_code=409, detail=f"Recipe {recipe.id} already exists")

        recipe_manager.save_recipe(recipe)
        return {"success": True, "recipe_id": recipe.id, "message": "Recipe imported successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid recipe data: {str(e)}")


@app.get("/recipes/export-all")
async def export_all_recipes(format: str = "json"):
    """Export all recipes as a bundle."""
    import yaml

    recipes = recipe_manager.list_recipes()
    data = {"version": "1.0", "recipes": [r.model_dump() for r in recipes]}

    if format.lower() == "yaml":
        content = yaml.dump(data, default_flow_style=False, sort_keys=False)
        return {"format": "yaml", "content": content, "count": len(recipes)}
    return {"format": "json", "content": data, "count": len(recipes)}


# =============================================================================
# Auto Recipe Generator (scan model and infer optimal settings)
# =============================================================================

@app.post("/generate-recipe")
async def generate_recipe(model_path: str, name: str = None):
    """Auto-generate an optimized recipe for a model by scanning its config."""
    gpu_info = await get_gpu_info()
    gpus = gpu_info.get("gpus", []) if isinstance(gpu_info, dict) else []

    try:
        recipe, analysis = generate_recipe_from_path(model_path, name, gpus)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"recipe": recipe.model_dump(), "analysis": analysis}


# =============================================================================
# FP8 KV Cache Advisor
# =============================================================================

@app.get("/fp8-advisor")
async def fp8_kv_advisor(model_path: str = None):
    """Analyze if FP8 KV cache would benefit a model configuration."""
    import json as json_lib
    from pathlib import Path

    # Get current running model if no path specified
    if not model_path:
        current = ProcessManager.get_current_process(settings.vllm_port)
        if current:
            model_path = current.model_path
        else:
            return {"error": "No model running and no model_path specified"}

    model_dir = Path(model_path)
    config_path = model_dir / "config.json"

    analysis = {
        "model_path": model_path,
        "fp8_kv_recommended": False,
        "reasons": [],
        "expected_memory_savings": None,
        "compatibility": "unknown",
        "instructions": None,
    }

    if not config_path.exists():
        analysis["compatibility"] = "cannot_analyze"
        analysis["reasons"].append("No config.json found")
        return analysis

    with open(config_path) as f:
        config = json_lib.load(f)

    hidden_size = config.get("hidden_size", 4096)
    num_layers = config.get("num_hidden_layers", 32)
    num_kv_heads = config.get("num_key_value_heads", config.get("num_attention_heads", 32))
    head_dim = hidden_size // config.get("num_attention_heads", 32)

    # Get GPU info
    gpu_info = await get_gpu_info()
    gpus = gpu_info.get("gpus", [])

    # Calculate KV cache size per token
    kv_bytes_per_token_fp16 = 2 * num_layers * num_kv_heads * head_dim * 2  # 2 for K and V
    kv_bytes_per_token_fp8 = kv_bytes_per_token_fp16 // 2

    # Check if model is already quantized
    name_lower = model_dir.name.lower()
    is_quantized = any(x in name_lower for x in ["awq", "gptq", "int4", "int8", "fp8"])

    # GPU compatibility check (H100, A100, RTX 4090, etc. support FP8)
    fp8_capable_gpus = ["H100", "H200", "A100", "RTX 4090", "RTX 4080", "L40", "L4"]
    has_fp8_gpu = any(any(cap in gpu.get("name", "") for cap in fp8_capable_gpus) for gpu in gpus)

    analysis["compatibility"] = "supported" if has_fp8_gpu else "not_supported"

    if not has_fp8_gpu:
        analysis["reasons"].append("GPUs don't support native FP8 (need H100, A100, RTX 40xx, L40)")
        return analysis

    # Recommendation logic
    if num_layers >= 40:
        analysis["fp8_kv_recommended"] = True
        analysis["reasons"].append(f"Large model ({num_layers} layers) - FP8 KV saves significant memory")

    if hidden_size >= 8192:
        analysis["fp8_kv_recommended"] = True
        analysis["reasons"].append(f"Large hidden size ({hidden_size}) - high KV cache memory usage")

    if not is_quantized:
        analysis["fp8_kv_recommended"] = True
        analysis["reasons"].append("FP16 model weights - FP8 KV cache provides best memory savings")
    else:
        analysis["reasons"].append("Model already quantized - FP8 KV still beneficial but less impactful")

    # Calculate expected savings
    total_gpu_mem = sum(g.get("memory_total_mb", 0) for g in gpus)
    expected_kv_fp16 = (kv_bytes_per_token_fp16 * 32768) / (1024**2)  # MB for 32k context
    expected_kv_fp8 = (kv_bytes_per_token_fp8 * 32768) / (1024**2)
    savings_mb = expected_kv_fp16 - expected_kv_fp8

    analysis["expected_memory_savings"] = {
        "per_32k_context_mb": round(savings_mb, 0),
        "kv_size_fp16_mb": round(expected_kv_fp16, 0),
        "kv_size_fp8_mb": round(expected_kv_fp8, 0),
        "percent_savings": 50,
    }

    if analysis["fp8_kv_recommended"]:
        analysis["instructions"] = {
            "vllm_args": "--kv-cache-dtype fp8 --calculate-kv-scales",
            "recipe_changes": {"kv_cache_dtype": "fp8", "calculate_kv_scales": True},
        }

    return analysis


# =============================================================================
# VRAM Calculator / Estimator
# =============================================================================

@app.get("/vram-calculator")
async def calculate_vram(
    model_path: str = None,
    context_length: int = 32768,
    batch_size: int = 12,
    tp_size: int = 1,
    quantization: str = "auto",
    kv_cache_dtype: str = "fp16"  # fp16, fp8
):
    """Estimate VRAM usage for a model configuration (LMStudio-style)."""
    import json as json_lib
    from pathlib import Path

    if not model_path:
        return {"error": "model_path required"}

    model_dir = Path(model_path)
    config_path = model_dir / "config.json"

    if not config_path.exists():
        return {"error": "No config.json found in model directory"}

    with open(config_path) as f:
        config = json_lib.load(f)

    # Extract model parameters
    hidden_size = config.get("hidden_size", 4096)
    num_layers = config.get("num_hidden_layers", 32)
    num_heads = config.get("num_attention_heads", 32)
    num_kv_heads = config.get("num_key_value_heads", num_heads)
    vocab_size = config.get("vocab_size", 32000)
    intermediate_size = config.get("intermediate_size", hidden_size * 4)
    num_experts = config.get("num_experts") or config.get("num_local_experts", 0)
    head_dim = config.get("head_dim", hidden_size // num_heads)
    max_position_embeddings = config.get("max_position_embeddings", 32768)

    # Detect quantization from model name
    name_lower = model_dir.name.lower()
    if quantization == "auto":
        if "awq" in name_lower or "int4" in name_lower or "w4a16" in name_lower:
            quantization = "int4"
        elif "gptq" in name_lower:
            quantization = "gptq"
        elif "int8" in name_lower or "w8a8" in name_lower:
            quantization = "int8"
        elif "fp8" in name_lower:
            quantization = "fp8"
        else:
            quantization = "fp16"

    bytes_per_param = {"int4": 0.5, "gptq": 0.5, "int8": 1, "fp8": 1, "fp16": 2, "bf16": 2, "fp32": 4}.get(quantization, 2)

    # Calculate model weights size using actual file size if available
    model_files = list(model_dir.glob("*.safetensors")) + list(model_dir.glob("*.bin"))
    if model_files:
        actual_model_size_gb = sum(f.stat().st_size for f in model_files) / (1024**3)
    else:
        # Estimate from parameters
        attention_params = num_layers * (4 * hidden_size * hidden_size)
        mlp_params = num_layers * (3 * hidden_size * intermediate_size)
        if num_experts > 0:
            mlp_params *= num_experts
        embedding_params = vocab_size * hidden_size * 2
        total_params = attention_params + mlp_params + embedding_params
        actual_model_size_gb = (total_params * bytes_per_param) / (1024**3)

    # Calculate KV cache size (formula: 2 * num_layers * num_kv_heads * head_dim * bytes_per_element)
    # The "2" accounts for both K and V tensors
    kv_bytes_per_element = 1 if kv_cache_dtype == "fp8" else 2  # FP8 = 1 byte, FP16 = 2 bytes
    kv_bytes_per_token = 2 * num_layers * num_kv_heads * head_dim * kv_bytes_per_element

    # Total KV cache = per_token * context_length * max_concurrent_sequences
    kv_cache_size_gb = (kv_bytes_per_token * context_length * batch_size) / (1024**3)

    # Activation memory (more accurate estimate based on batch size and hidden size)
    # Activations are typically 2-4x hidden_size per token during forward pass
    activation_gb = (hidden_size * batch_size * 4 * 2) / (1024**3)  # Much smaller than before

    # CUDA kernels, graph memory, and runtime overhead
    overhead_gb = 1.5 + (0.2 * tp_size)  # Base + per-GPU overhead

    total_vram = actual_model_size_gb + kv_cache_size_gb + activation_gb + overhead_gb
    per_gpu_vram = total_vram / tp_size

    # Get available GPU memory
    gpu_info = await get_gpu_info()
    gpus = gpu_info.get("gpus", [])
    available_per_gpu = gpus[0].get("memory_total_mb", 24000) / 1024 if gpus else 24

    # Calculate if it fits
    fits = per_gpu_vram < available_per_gpu * 0.95

    # Recommendations
    recommendations = []
    if not fits:
        if tp_size < len(gpus):
            recommendations.append(f"Increase TP to {min(len(gpus), tp_size * 2)} GPUs")
        if kv_cache_dtype == "fp16":
            savings = kv_cache_size_gb / 2
            recommendations.append(f"Use FP8 KV cache (saves ~{savings:.1f} GB)")
        if context_length > 32768:
            recommendations.append(f"Reduce context length to {context_length // 2}")
        if quantization == "fp16":
            recommendations.append("Use AWQ/GPTQ quantized version")
        if batch_size > 4:
            recommendations.append(f"Reduce max_num_seqs to {batch_size // 2}")

    # Calculate configs for different context lengths (LMStudio-style comparison)
    context_options = [4096, 8192, 16384, 32768, 65536, 131072]
    context_configs = []
    for ctx in context_options:
        if ctx <= max_position_embeddings:
            ctx_kv = (kv_bytes_per_token * ctx * batch_size) / (1024**3)
            ctx_total = actual_model_size_gb + ctx_kv + activation_gb + overhead_gb
            ctx_per_gpu = ctx_total / tp_size
            context_configs.append({
                "context_length": ctx,
                "kv_cache_gb": round(ctx_kv, 2),
                "total_gb": round(ctx_total, 2),
                "per_gpu_gb": round(ctx_per_gpu, 2),
                "fits": ctx_per_gpu < available_per_gpu * 0.95,
                "utilization_pct": round((ctx_per_gpu / available_per_gpu) * 100, 1)
            })

    return {
        "model_path": model_path,
        "quantization": quantization,
        "kv_cache_dtype": kv_cache_dtype,
        "context_length": context_length,
        "batch_size": batch_size,
        "tp_size": tp_size,
        "breakdown": {
            "model_weights_gb": round(actual_model_size_gb, 2),
            "kv_cache_gb": round(kv_cache_size_gb, 2),
            "activations_gb": round(activation_gb, 2),
            "overhead_gb": round(overhead_gb, 2),
            "total_gb": round(total_vram, 2),
            "per_gpu_gb": round(per_gpu_vram, 2),
        },
        "gpu_info": {
            "num_gpus": len(gpus),
            "memory_per_gpu_gb": round(available_per_gpu, 1),
            "total_available_gb": round(available_per_gpu * len(gpus), 1),
        },
        "fits": fits,
        "utilization_percent": round((per_gpu_vram / available_per_gpu) * 100, 1),
        "recommendations": recommendations,
        "context_configs": context_configs,
        "model_info": {
            "num_layers": num_layers,
            "hidden_size": hidden_size,
            "num_kv_heads": num_kv_heads,
            "head_dim": head_dim,
            "num_experts": num_experts,
            "max_context": max_position_embeddings,
            "kv_bytes_per_token": kv_bytes_per_token,
        }
    }


# =============================================================================
# Model Compatibility Checker
# =============================================================================

@app.get("/compatibility")
async def check_compatibility(model_path: str):
    """Check if a model is compatible with available backends and hardware."""
    import json as json_lib
    from pathlib import Path

    model_dir = Path(model_path)
    if not model_dir.exists():
        raise HTTPException(status_code=404, detail=f"Model path not found: {model_path}")

    result = {
        "model_path": model_path,
        "vllm_compatible": True,
        "sglang_compatible": True,
        "issues": [],
        "warnings": [],
        "supported_features": [],
    }

    config_path = model_dir / "config.json"
    name_lower = model_dir.name.lower()

    # Check for required files
    safetensor_files = list(model_dir.glob("*.safetensors"))
    bin_files = list(model_dir.glob("*.bin"))
    gguf_files = list(model_dir.glob("*.gguf"))

    if gguf_files:
        result["vllm_compatible"] = False
        result["sglang_compatible"] = False
        result["issues"].append("GGUF format not supported by vLLM/SGLang (use llama.cpp)")
        return result

    if not safetensor_files and not bin_files:
        result["issues"].append("No model weight files found (.safetensors or .bin)")
        result["vllm_compatible"] = False
        result["sglang_compatible"] = False

    if not config_path.exists():
        result["warnings"].append("No config.json - may have issues loading")
    else:
        with open(config_path) as f:
            config = json_lib.load(f)

        arch = config.get("architectures", ["Unknown"])[0]
        num_experts = config.get("num_experts") or config.get("num_local_experts", 0)

        # Architecture compatibility
        vllm_supported = [
            "LlamaForCausalLM", "MistralForCausalLM", "Qwen2ForCausalLM",
            "Qwen3ForCausalLM", "MixtralForCausalLM", "DeepseekV2ForCausalLM",
            "ChatGLMModel", "GemmaForCausalLM", "Phi3ForCausalLM",
        ]

        if arch not in vllm_supported:
            result["warnings"].append(f"Architecture {arch} may not be fully supported")

        # Feature detection
        if num_experts > 0:
            result["supported_features"].append("MoE (Mixture of Experts)")
        if config.get("use_sliding_window"):
            result["supported_features"].append("Sliding Window Attention")
        if config.get("rope_scaling"):
            result["supported_features"].append("RoPE Scaling (extended context)")

    # Check quantization compatibility
    if "exl3" in name_lower or "exl2" in name_lower:
        result["vllm_compatible"] = False
        result["sglang_compatible"] = False
        result["issues"].append("EXL2/EXL3 format requires TabbyAPI/ExLlamaV2")

    if "awq" in name_lower:
        result["supported_features"].append("AWQ Quantization")
    if "gptq" in name_lower:
        result["supported_features"].append("GPTQ Quantization")
    if "fp8" in name_lower:
        result["supported_features"].append("FP8 Quantization")

    # GPU compatibility
    gpu_info = await get_gpu_info()
    gpus = gpu_info.get("gpus", [])

    if not gpus:
        result["issues"].append("No GPUs detected")
        result["vllm_compatible"] = False
    else:
        total_vram = sum(g.get("memory_total_mb", 0) for g in gpus)
        result["hardware"] = {
            "num_gpus": len(gpus),
            "gpu_names": [g.get("name", "Unknown") for g in gpus],
            "total_vram_gb": round(total_vram / 1024, 1),
        }

    return result


# =============================================================================
# Quick Launch Presets
# =============================================================================

PRESETS = {
    "high_throughput": {
        "name": "High Throughput",
        "description": "Optimized for maximum tokens/sec with larger batches",
        "settings": {
            "max_num_seqs": 24,
            "max_num_batched_tokens": 16384,
            "gpu_memory_utilization": 0.92,
            "disable_log_requests": True,
        }
    },
    "low_latency": {
        "name": "Low Latency",
        "description": "Optimized for fast time-to-first-token",
        "settings": {
            "max_num_seqs": 4,
            "max_num_batched_tokens": 4096,
            "gpu_memory_utilization": 0.85,
        }
    },
    "long_context": {
        "name": "Long Context",
        "description": "Optimized for long documents (64k+ tokens)",
        "settings": {
            "max_model_len": 131072,
            "max_num_seqs": 4,
            "kv_cache_dtype": "fp8",
            "calculate_kv_scales": True,
            "swap_space": 32,
        }
    },
    "memory_efficient": {
        "name": "Memory Efficient",
        "description": "Minimizes VRAM usage for constrained environments",
        "settings": {
            "gpu_memory_utilization": 0.75,
            "max_num_seqs": 6,
            "max_model_len": 16384,
            "swap_space": 32,
        }
    },
    "tool_calling": {
        "name": "Tool Calling",
        "description": "Optimized for function calling and agents",
        "settings": {
            "enable_auto_tool_choice": True,
            "max_num_seqs": 8,
        }
    },
}


@app.get("/presets")
async def list_presets():
    """List available quick-launch presets."""
    return {"presets": PRESETS}


@app.post("/recipes/{recipe_id}/apply-preset")
async def apply_preset_to_recipe(recipe_id: str, preset_name: str):
    """Apply a preset's settings to an existing recipe."""
    recipe = recipe_manager.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if preset_name not in PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown preset: {preset_name}")

    preset = PRESETS[preset_name]
    recipe_data = recipe.model_dump()
    recipe_data.update(preset["settings"])

    updated_recipe = Recipe(**recipe_data)
    recipe_manager.save_recipe(updated_recipe)

    return {
        "success": True,
        "recipe_id": recipe_id,
        "preset_applied": preset_name,
        "updated_settings": preset["settings"],
    }


# =============================================================================
# Inference Benchmark Tool
# =============================================================================

@app.post("/benchmark")
async def run_benchmark(
    prompt: str = "Write a detailed essay about artificial intelligence.",
    max_tokens: int = 256,
    num_requests: int = 5,
    concurrent: int = 1
):
    """Run a simple inference benchmark on the current model."""
    import time
    import asyncio

    current = ProcessManager.get_current_process(settings.vllm_port)
    if not current:
        raise HTTPException(status_code=400, detail="No model running")

    results = {
        "model_path": current.model_path,
        "prompt_tokens": None,
        "max_tokens": max_tokens,
        "num_requests": num_requests,
        "concurrent": concurrent,
        "latencies_ms": [],
        "ttft_ms": [],
        "generation_tokens": [],
        "errors": 0,
    }

    async def single_request():
        try:
            start = time.perf_counter()
            first_token_time = None
            gen_tokens = 0

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://localhost:{settings.vllm_port}/v1/chat/completions",
                    json={
                        "model": current.model_path,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": max_tokens,
                        "stream": True,
                    },
                    timeout=120.0
                )

                async for line in response.aiter_lines():
                    if line.startswith("data: ") and "[DONE]" not in line:
                        if first_token_time is None:
                            first_token_time = time.perf_counter()
                        gen_tokens += 1

            end = time.perf_counter()
            latency = (end - start) * 1000
            ttft = (first_token_time - start) * 1000 if first_token_time else None

            return {"latency_ms": latency, "ttft_ms": ttft, "tokens": gen_tokens, "error": None}
        except Exception as e:
            return {"latency_ms": None, "ttft_ms": None, "tokens": 0, "error": str(e)}

    # Run requests
    for batch_start in range(0, num_requests, concurrent):
        batch_size = min(concurrent, num_requests - batch_start)
        tasks = [single_request() for _ in range(batch_size)]
        batch_results = await asyncio.gather(*tasks)

        for r in batch_results:
            if r["error"]:
                results["errors"] += 1
            else:
                if r["latency_ms"]:
                    results["latencies_ms"].append(r["latency_ms"])
                if r["ttft_ms"]:
                    results["ttft_ms"].append(r["ttft_ms"])
                results["generation_tokens"].append(r["tokens"])

    # Calculate statistics
    if results["latencies_ms"]:
        results["stats"] = {
            "avg_latency_ms": round(sum(results["latencies_ms"]) / len(results["latencies_ms"]), 2),
            "min_latency_ms": round(min(results["latencies_ms"]), 2),
            "max_latency_ms": round(max(results["latencies_ms"]), 2),
            "avg_ttft_ms": round(sum(results["ttft_ms"]) / len(results["ttft_ms"]), 2) if results["ttft_ms"] else None,
            "total_tokens": sum(results["generation_tokens"]),
            "tokens_per_sec": round(sum(results["generation_tokens"]) / (sum(results["latencies_ms"]) / 1000), 2),
            "success_rate": round((num_requests - results["errors"]) / num_requests * 100, 1),
        }

    return results


# =============================================================================
# Model Health Monitor
# =============================================================================

_health_history = []


@app.get("/health-history")
async def get_health_history(limit: int = 100):
    """Get recent health/metrics history."""
    return {"history": _health_history[-limit:], "count": len(_health_history)}


@app.post("/health-sample")
async def record_health_sample():
    """Record a health sample (call periodically for monitoring)."""
    import time

    metrics = await get_performance_metrics()
    gpu_info = await get_gpu_info()

    sample = {
        "timestamp": time.time(),
        "metrics": metrics,
        "gpus": gpu_info.get("gpus", []),
    }

    _health_history.append(sample)

    # Keep only last 1000 samples
    if len(_health_history) > 1000:
        _health_history.pop(0)

    return {"recorded": True, "sample": sample}


@app.get("/health-summary")
async def get_health_summary():
    """Get a summary of recent health data."""
    if not _health_history:
        return {"error": "No health data recorded yet. Call POST /health-sample periodically."}

    recent = _health_history[-60:]  # Last 60 samples

    # Aggregate metrics
    running_requests = [s["metrics"].get("running_requests", 0) for s in recent if s["metrics"].get("running_requests") is not None]
    kv_usage = [s["metrics"].get("kv_cache_usage", 0) for s in recent if s["metrics"].get("kv_cache_usage") is not None]
    gpu_temps = []
    gpu_powers = []
    for s in recent:
        for gpu in s.get("gpus", []):
            if gpu.get("temp_c"):
                gpu_temps.append(gpu["temp_c"])
            if gpu.get("power_w"):
                gpu_powers.append(gpu["power_w"])

    return {
        "samples": len(recent),
        "time_range_sec": recent[-1]["timestamp"] - recent[0]["timestamp"] if len(recent) > 1 else 0,
        "avg_running_requests": round(sum(running_requests) / len(running_requests), 2) if running_requests else None,
        "max_running_requests": max(running_requests) if running_requests else None,
        "avg_kv_cache_usage_pct": round(sum(kv_usage) / len(kv_usage), 2) if kv_usage else None,
        "max_kv_cache_usage_pct": max(kv_usage) if kv_usage else None,
        "avg_gpu_temp_c": round(sum(gpu_temps) / len(gpu_temps), 1) if gpu_temps else None,
        "max_gpu_temp_c": max(gpu_temps) if gpu_temps else None,
        "avg_gpu_power_w": round(sum(gpu_powers) / len(gpu_powers), 1) if gpu_powers else None,
    }


# =============================================================================
# Chat Persistence
# =============================================================================

@app.get("/chats", response_model=list[ChatSession])
async def list_chats(limit: int = 50):
    """List all chat sessions."""
    return chat_store.list_sessions(limit)


@app.post("/chats", response_model=ChatSession)
async def create_chat(title: str = "New Chat", model: str = None):
    """Create a new chat session."""
    return chat_store.create_session(title=title, model=model)


@app.get("/chats/{session_id}", response_model=ChatSession)
async def get_chat(session_id: str):
    """Get a chat session with all messages."""
    session = chat_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session


@app.put("/chats/{session_id}")
async def update_chat(session_id: str, title: str = None, model: str = None):
    """Update chat session metadata."""
    success = chat_store.update_session(session_id, title=title, model=model)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"status": "updated"}


@app.delete("/chats/{session_id}")
async def delete_chat(session_id: str):
    """Delete a chat session."""
    success = chat_store.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"status": "deleted"}


class AddMessageRequest(BaseModel):
    id: Optional[str] = None
    role: str
    content: str
    model: Optional[str] = None
    tool_calls: Optional[list] = None


@app.post("/chats/{session_id}/messages", response_model=ChatMessage)
async def add_message(session_id: str, request: AddMessageRequest):
    """Add a message to a chat session."""
    # Verify session exists
    session = chat_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return chat_store.add_message(
        session_id=session_id,
        role=request.role,
        content=request.content,
        model=request.model,
        tool_calls=request.tool_calls,
        message_id=request.id,
    )


class ForkChatRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    message_id: Optional[str] = None


@app.post("/chats/{session_id}/fork", response_model=ChatSession)
async def fork_chat(session_id: str, request: ForkChatRequest):
    """Fork a chat session into a new session (optionally at a specific message)."""
    forked = chat_store.fork_session(
        session_id,
        title=request.title,
        model=request.model,
        message_id=request.message_id,
    )
    if not forked:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return forked


@app.get("/chats/{session_id}/usage")
async def chat_usage(session_id: str):
    """Return token usage totals for a session."""
    usage = chat_store.get_session_usage(session_id)
    if not usage:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return usage


# =============================================================================
# MCP (Model Context Protocol) Endpoints
# =============================================================================

from .mcp_manager import get_mcp_manager, MCPServer


class MCPServerCreateRequest(BaseModel):
    name: str
    command: str
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True


class MCPServerUpdateRequest(BaseModel):
    command: Optional[str] = None
    args: Optional[list[str]] = None
    env: Optional[dict[str, str]] = None
    enabled: Optional[bool] = None


@app.get("/mcp/servers")
async def list_mcp_servers():
    """List configured MCP servers."""
    mgr = get_mcp_manager()
    return {"servers": mgr.get_servers_info()}


@app.post("/mcp/servers")
async def add_mcp_server(request: MCPServerCreateRequest):
    """Add an MCP server."""
    mgr = get_mcp_manager()
    if request.name in mgr.servers:
        raise HTTPException(status_code=409, detail="MCP server already exists")
    server = MCPServer(
        name=request.name,
        command=request.command,
        args=request.args or [],
        env=request.env or {},
        enabled=request.enabled,
    )
    mgr.add_server(server)
    return {"status": "added", "server": server.name}


@app.put("/mcp/servers/{name}")
async def update_mcp_server(name: str, request: MCPServerUpdateRequest):
    """Update an MCP server configuration (e.g., enable/disable)."""
    mgr = get_mcp_manager()
    existing = mgr.servers.get(name)
    if not existing:
        raise HTTPException(status_code=404, detail="MCP server not found")

    updated = MCPServer(
        name=name,
        command=request.command if request.command is not None else existing.command,
        args=request.args if request.args is not None else existing.args,
        env=request.env if request.env is not None else existing.env,
        enabled=request.enabled if request.enabled is not None else existing.enabled,
    )
    mgr.add_server(updated)
    return {"status": "updated", "server": name}


@app.delete("/mcp/servers/{name}")
async def remove_mcp_server(name: str):
    """Remove an MCP server."""
    mgr = get_mcp_manager()
    mgr.remove_server(name)
    return {"status": "removed", "server": name}


@app.get("/mcp/tools")
async def list_mcp_tools(server: str = None):
    """List tools from MCP servers."""
    mgr = get_mcp_manager()
    tools = await mgr.list_tools(server)
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


@app.post("/mcp/tools/{server}/{tool_name}")
async def call_mcp_tool(
    server: str,
    tool_name: str,
    arguments: dict[str, Any] = {},
):
    """Call a tool on an MCP server."""
    mgr = get_mcp_manager()
    result = await mgr.call_tool(server, tool_name, arguments)
    return {"result": result}


@app.get("/mcp/resources")
async def list_mcp_resources(server: str = None):
    """List resources from MCP servers."""
    mgr = get_mcp_manager()
    resources = await mgr.list_resources(server)
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


@app.get("/mcp/resources/{server}")
async def read_mcp_resource(server: str, uri: str):
    """Read a resource from an MCP server."""
    mgr = get_mcp_manager()
    content = await mgr.read_resource(server, uri)
    return {"content": content}


# =============================================================================
# Skills / Quick Actions
# =============================================================================

# Skills are pre-defined prompts/templates that can be quickly invoked

SKILLS = {
    "summarize": {
        "name": "Summarize",
        "description": "Summarize the given text",
        "prompt": "Please provide a concise summary of the following:\n\n{input}",
        "icon": "FileText",
    },
    "explain": {
        "name": "Explain",
        "description": "Explain a concept in simple terms",
        "prompt": "Please explain the following concept in simple, easy-to-understand terms:\n\n{input}",
        "icon": "Lightbulb",
    },
    "code_review": {
        "name": "Code Review",
        "description": "Review code for issues and improvements",
        "prompt": "Please review the following code. Identify any bugs, security issues, or areas for improvement:\n\n```\n{input}\n```",
        "icon": "Code",
    },
    "translate": {
        "name": "Translate",
        "description": "Translate text to another language",
        "prompt": "Please translate the following text to {language}:\n\n{input}",
        "icon": "Globe",
        "params": {"language": "English"},
    },
    "fix_grammar": {
        "name": "Fix Grammar",
        "description": "Fix grammar and spelling errors",
        "prompt": "Please fix any grammar and spelling errors in the following text while preserving the meaning:\n\n{input}",
        "icon": "CheckSquare",
    },
    "brainstorm": {
        "name": "Brainstorm",
        "description": "Generate ideas about a topic",
        "prompt": "Please brainstorm 5-10 creative ideas related to:\n\n{input}",
        "icon": "Zap",
    },
    "debug": {
        "name": "Debug",
        "description": "Help debug an error or issue",
        "prompt": "I'm encountering the following error/issue. Please help me understand what's wrong and how to fix it:\n\n{input}",
        "icon": "Bug",
    },
    "write_tests": {
        "name": "Write Tests",
        "description": "Generate unit tests for code",
        "prompt": "Please write comprehensive unit tests for the following code:\n\n```\n{input}\n```",
        "icon": "TestTube",
    },
}


@app.get("/skills")
async def list_skills():
    """List available skills."""
    return {
        "skills": [
            {
                "id": skill_id,
                "name": skill["name"],
                "description": skill["description"],
                "icon": skill.get("icon", "Sparkles"),
                "params": skill.get("params", {}),
            }
            for skill_id, skill in SKILLS.items()
        ]
    }


@app.post("/skills/{skill_id}")
async def apply_skill(skill_id: str, input: str, params: dict[str, str] = {}):
    """Apply a skill to input text."""
    if skill_id not in SKILLS:
        raise HTTPException(status_code=404, detail=f"Skill {skill_id} not found")

    skill = SKILLS[skill_id]
    prompt_template = skill["prompt"]

    # Merge default params with provided params
    all_params = {**skill.get("params", {}), **params, "input": input}

    try:
        prompt = prompt_template.format(**all_params)
        return {"prompt": prompt, "skill": skill_id}
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing parameter: {e}")
