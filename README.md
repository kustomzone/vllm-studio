# vLLM Studio

Model management API for vLLM and SGLang inference servers. Launch, switch, and manage LLM models via HTTP API with a modern web dashboard.

## Features

- **Modern Web Dashboard** - OpenWebUI-style dark theme with sidebar navigation
- **Recipe System** - JSON-based launch configurations
- **Hot Switching** - Switch models without stopping the server
- **Auto-Switching** - Automatically switch models based on API request
- **Built-in Chat** - Chat with models directly in the dashboard
- **Real-time Logs** - View and monitor model logs
- **Proxy Integration** - Anthropic/OpenAI format translation

## Quick Start

```bash
# One-command startup
./start.sh

# Open dashboard
open http://localhost:8080
```

### Start Options

```bash
# Development mode (foreground with auto-reload)
./start.sh --dev

# Custom port
./start.sh --port 9000

# With ngrok tunnel for remote access
./start.sh --ngrok
```

## Web Dashboard

Access the dashboard at **http://localhost:8080**:

### Views

| View | Description |
|------|-------------|
| **Dashboard** | Model status, system health, quick launch |
| **Chat** | Chat with the running model (streaming) |
| **Logs** | Real-time log viewer with filtering |
| **Recipes** | Full CRUD management of recipes |

### Features

- Dark theme (OpenWebUI-style)
- Sidebar navigation with keyboard shortcuts (Ctrl+1-4)
- Toast notifications for all actions
- Auto-refresh every 10 seconds
- Mobile responsive

## Configuration

Environment variables (set in `.env` or export):

| Variable | Default | Description |
|----------|---------|-------------|
| `VLLMSTUDIO_API_PORT` | 8080 | Studio API port |
| `VLLMSTUDIO_VLLM_PORT` | 8000 | Backend inference port |
| `VLLMSTUDIO_PROXY_PORT` | 8001 | Proxy port |
| `VLLMSTUDIO_MODELS_DIR` | /mnt/llm_models | Model storage directory |
| `VLLMSTUDIO_RECIPES_DIR` | ./recipes | Recipe JSON files |

## Recipes

Recipes are JSON files in `recipes/` that define model launch configurations.

### Example Recipe

```json
{
  "id": "qwen3-235b",
  "name": "Qwen3 235B INT4",
  "model_path": "/mnt/llm_models/Qwen3-235B-A22B-Instruct-INT4",
  "backend": "vllm",
  "tensor_parallel_size": 8,
  "max_model_len": 131072,
  "gpu_memory_utilization": 0.85,
  "kv_cache_dtype": "fp8",
  "tool_call_parser": "hermes"
}
```

### Recipe Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | required | Unique identifier |
| `name` | string | required | Display name |
| `model_path` | string | required | Path to model directory |
| `backend` | string | "vllm" | Backend: `vllm` or `sglang` |
| `tensor_parallel_size` | int | 1 | TP sharding across GPUs |
| `pipeline_parallel_size` | int | 1 | PP sharding across GPUs |
| `data_parallel_size` | int | 1 | DP replicas |
| `max_model_len` | int | 32768 | Maximum context length |
| `gpu_memory_utilization` | float | 0.85 | GPU memory fraction |
| `kv_cache_dtype` | string | "auto" | KV cache type: auto, fp8, fp8_e4m3 |
| `swap_space` | int | 16 | CPU swap space in GB |
| `max_num_seqs` | int | 12 | Max concurrent sequences |
| `max_num_batched_tokens` | int | 8192 | Max tokens per batch |
| `block_size` | int | 32 | Paged attention block size |
| `enable_expert_parallel` | bool | false | MoE expert parallelism |
| `disable_custom_all_reduce` | bool | true | Disable custom all-reduce |
| `trust_remote_code` | bool | true | Trust remote code |
| `tool_call_parser` | string | null | Tool parser: hermes, mistral, llama3_json, etc. |
| `reasoning_parser` | string | null | Reasoning parser for CoT |
| `quantization` | string | null | Quantization method |
| `dtype` | string | null | Model dtype: float16, bfloat16 |
| `cuda_visible_devices` | string | null | GPU selection (e.g., "0,1,2,3") |
| `extra_args` | object | {} | Additional CLI arguments |

## API Reference

### Health & Status

```bash
# Health check
curl http://localhost:8080/health

# Detailed status
curl http://localhost:8080/status
```

### Recipes

```bash
# List all recipes
curl http://localhost:8080/recipes

# Get specific recipe
curl http://localhost:8080/recipes/qwen3-235b

# Create recipe
curl -X POST http://localhost:8080/recipes \
  -H "Content-Type: application/json" \
  -d '{"id": "my-model", "name": "My Model", "model_path": "/path/to/model"}'

# Update recipe
curl -X PUT http://localhost:8080/recipes/my-model \
  -H "Content-Type: application/json" \
  -d '{"id": "my-model", "name": "Updated Name", "model_path": "/path/to/model"}'

# Delete recipe
curl -X DELETE http://localhost:8080/recipes/my-model
```

### Model Management

```bash
# Switch to a model (evicts current model first)
curl -X POST http://localhost:8080/switch \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": "qwen3-235b"}'

# Force switch (kills process immediately)
curl -X POST http://localhost:8080/switch \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": "qwen3-235b", "force": true}'

# Launch by recipe ID (alias for switch)
curl -X POST http://localhost:8080/launch/qwen3-235b

# Evict current model
curl -X POST http://localhost:8080/evict

# Force evict
curl -X POST "http://localhost:8080/evict?force=true"

# Wait for model ready (default 300s timeout)
curl "http://localhost:8080/wait-ready?timeout=600"

# Get running model info
curl http://localhost:8080/models/running

# List all inference processes
curl http://localhost:8080/processes
```

### Model Discovery

```bash
# List all models in models_dir
curl http://localhost:8080/models
```

### Proxy Passthrough

Requests to `/v1/*` are proxied to the backend inference server:

```bash
# Chat completion (proxied to vLLM/SGLang)
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-235b",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# List models on backend
curl http://localhost:8080/v1/models
```

## Workflow Examples

### Switch Models

```bash
# Check what's running
curl -s http://localhost:8080/status | jq '.running_process.model_path'

# Switch to a different model
curl -X POST http://localhost:8080/switch \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": "minimax-m2"}'

# Wait for it to be ready
curl "http://localhost:8080/wait-ready?timeout=300"

# Verify it's running
curl http://localhost:8080/health
```

### Create and Launch a New Model

```bash
# Create recipe
curl -X POST http://localhost:8080/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "llama3-70b",
    "name": "Llama 3 70B",
    "model_path": "/mnt/llm_models/Meta-Llama-3-70B-Instruct",
    "tensor_parallel_size": 4,
    "max_model_len": 8192,
    "tool_call_parser": "llama3_json"
  }'

# Launch it
curl -X POST http://localhost:8080/launch/llama3-70b

# Wait and verify
curl "http://localhost:8080/wait-ready?timeout=300"
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client App    │────▶│  vLLM Studio    │────▶│  vLLM/SGLang    │
│                 │     │   (port 8080)   │     │   (port 8000)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  recipes/*.json │
                        └─────────────────┘
```

- **vLLM Studio** manages recipes and controls the backend process
- **Backend** (vLLM or SGLang) runs the actual model inference
- **Recipes** are JSON files that define launch configurations
- Only one model runs at a time on the configured port

## SGLang Support

For SGLang backend, set `"backend": "sglang"` in the recipe:

```json
{
  "id": "minimax-sglang",
  "name": "MiniMax M2 (SGLang)",
  "model_path": "/mnt/llm_models/MiniMax-M2-AWQ-4bit",
  "backend": "sglang",
  "tensor_parallel_size": 8,
  "max_model_len": 196608,
  "extra_args": {
    "chunked-prefill-size": 4096
  }
}
```

SGLang uses the frozen venv at `/opt/venvs/frozen/sglang-prod/bin/python`.

## Logs

Model launch logs are written to `/tmp/vllm_{recipe_id}.log`:

```bash
# View launch log
tail -f /tmp/vllm_qwen3-235b.log
```
