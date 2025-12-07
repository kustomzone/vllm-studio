# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vLLM Studio is a FastAPI-based model management service for vLLM and SGLang inference backends. It provides API-driven model switching, recipe management, and process control for LLM inference servers.

## Commands

```bash
# Setup (creates venv, installs dependencies)
./setup.sh

# Run the server
./run.sh

# Run with development reload
python -m vllmstudio.cli --reload

# Run with custom ports
python -m vllmstudio.cli --port 8080 --vllm-port 8000
```

## Configuration

Environment variables (prefix `VLLMSTUDIO_`), configured via `.env`:
- `VLLMSTUDIO_MODELS_DIR` - Model storage directory (default: `/mnt/llm_models`)
- `VLLMSTUDIO_RECIPES_DIR` - Recipe JSON storage (default: `./recipes`)
- `VLLMSTUDIO_API_PORT` - Studio API port (default: 8080)
- `VLLMSTUDIO_VLLM_PORT` - Backend inference port (default: 8000)
- `VLLMSTUDIO_PROXY_PORT` - Proxy port (default: 8001)

## Architecture

```
vllmstudio/
├── api.py           # FastAPI app, all endpoints, lifespan management
├── models.py        # Pydantic models (Recipe, ProcessInfo, etc.)
├── config.py        # Settings via pydantic-settings
├── process_manager.py  # Process detection, launch, kill, eviction
├── recipe_manager.py   # Recipe CRUD, JSON persistence in recipes/
├── model_indexer.py    # Scans models_dir for available models
└── cli.py           # Entry point, uvicorn launcher
```

**Key patterns:**
- `ProcessManager` is stateless with static methods - detects vLLM/SGLang via `psutil` process scanning
- `RecipeManager` loads/saves JSON files from `recipes/` directory
- Global `switching_lock` in api.py prevents concurrent model switches
- SGLang uses frozen venv at `/opt/venvs/frozen/sglang-prod/bin/python`

## Recipe Format

Recipes are JSON files in `recipes/` with launch configuration:
```json
{
  "id": "model-name",
  "name": "Display Name",
  "model_path": "/path/to/model",
  "backend": "vllm",  // or "sglang"
  "tensor_parallel_size": 8,
  "max_model_len": 32768,
  "gpu_memory_utilization": 0.85,
  "tool_call_parser": "hermes"  // enables auto tool choice
}
```

## API Endpoints

- `GET /health` - Health check with backend/proxy reachability
- `GET /status` - Running process and matched recipe
- `GET /recipes` - List recipes with status
- `POST /switch` - Switch to recipe (evicts current, launches new)
- `POST /evict` - Kill running model
- `GET /models` - List indexed models from models_dir
- `GET /v1/{path}` - Proxy passthrough to backend
