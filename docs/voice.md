<!-- CRITICAL -->
# Voice (STT/TTS) Integrations

vLLM Studio exposes OpenAI-compatible voice endpoints from the Bun controller and brokers requests to local CLI integrations.

## Endpoints

- STT: `POST /v1/audio/transcriptions` (multipart/form-data)
- TTS: `POST /v1/audio/speech` (JSON)

## STT (whisper.cpp)

### Requirements
- `whisper-cli` available on `PATH` (or set `VLLM_STUDIO_STT_CLI`)
- A local model file under `VLLM_STUDIO_MODELS_DIR/stt/`

### Environment

```bash
export VLLM_STUDIO_STT_CLI=whisper-cli
export VLLM_STUDIO_STT_MODEL=ggml-large-v3.bin
# Optional: hint the controller/UI about which acceleration backend you intend to use.
# If set to a non-cpu backend, STT will require a GPU lease (strict by default).
export VLLM_STUDIO_STT_BACKEND=vulkan
```

### Request

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/audio/transcriptions \
  -F "file=@sample.wav" \
  -F "model=ggml-large-v3.bin"
```

Response:

```json
{ "text": "..." }
```

## TTS (piper)

### Requirements
- `piper` available on `PATH` (or set `VLLM_STUDIO_TTS_CLI`)
- A local `.onnx` voice model under `VLLM_STUDIO_MODELS_DIR/tts/`

### Environment

```bash
export VLLM_STUDIO_TTS_CLI=piper
export VLLM_STUDIO_TTS_MODEL=en_US-amy-medium.onnx
# Optional: if set to a non-cpu backend, TTS will require a GPU lease (strict by default).
export VLLM_STUDIO_TTS_BACKEND=cuda
```

### Request

```bash
curl -sS -X POST http://127.0.0.1:8080/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"en_US-amy-medium.onnx","input":"hello","response_format":"wav"}' \
  --output out.wav
```

## Notes

- These integrations are local-only: no hosted voice URLs required.
- GPU acceleration backends vary by how the CLI is built; the controller treats this as an integration detail.
