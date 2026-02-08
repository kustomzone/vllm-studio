<!-- CRITICAL -->
# Image Generation Integration

vLLM Studio exposes an OpenAI-style image generation endpoint from the Bun controller and brokers requests to a local CLI integration.

## Endpoint

- `POST /v1/images/generations`

Response is OpenAI-like:

```json
{
  "created": 0,
  "data": [{ "b64_json": "..." }]
}
```

## Integration (stable-diffusion.cpp)

### Requirements
- `sd` CLI available on `PATH` (or set `VLLM_STUDIO_IMAGE_CLI`)
- A local model file under `VLLM_STUDIO_MODELS_DIR/image/`

### Environment

```bash
export VLLM_STUDIO_IMAGE_CLI=sd
export VLLM_STUDIO_IMAGE_MODEL=model.gguf
```

### Request

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{"model":"model.gguf","prompt":"a clean technical diagram, flat colors","width":1024,"height":1024,"steps":30}' \
  | jq -r '.data[0].b64_json' | head
```

## GPU Lease Conflicts

Image generation is treated as a GPU-conflicting service (`image`). In strict mode, if the GPU is leased by another service (typically `llm`), the controller returns:

- `409 Conflict` with `code: "gpu_lease_conflict"`

Clients can then choose:
- replace: stop the current lease holder and run image generation
- best-effort: try anyway (may fail/OOM)

