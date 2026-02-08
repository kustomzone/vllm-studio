<!-- CRITICAL -->
# Task 13 — STT + TTS Integrations (CLI-Driven, Cross-Vendor GPU When Available)

## Objective
Provide STT and TTS as **integrations** managed by the controller (Bun/TypeScript), where the actual inference is performed by external CLI components. Prefer solutions that can run on both NVIDIA and AMD GPUs (or have vendor-specific backends behind a stable CLI contract).

## Files Involved
- Controller:
  - `controller/src/services/service-manager.ts` (service definitions for `stt`, `tts`)
  - New integration adapters:
    - `controller/src/services/integrations/stt/*`
    - `controller/src/services/integrations/tts/*`
  - New routes:
    - `controller/src/routes/audio.ts` (OpenAI-style `/v1/audio/transcriptions` + `/v1/audio/speech`)
    - `controller/src/routes/services.ts` (start/stop/status)
- Frontend:
  - “Runtimes” panel (task-09)
  - Config page: STT/TTS configured model + endpoint state
- Docs:
  - `docs/voice.md`

## Changes
- Implement OpenAI-compatible audio endpoints in the controller:
  - `POST /v1/audio/transcriptions` (STT)
  - `POST /v1/audio/speech` (TTS)
  - These endpoints call integration adapters which invoke external CLI tools and return results.
- Integration adapter interface:
  - `isInstalled()`, `getVersion()`, `listModels()`
  - `transcribe(...)` for STT, `speak(...)` for TTS
  - `getBackends()` reporting `cpu|cuda|vulkan|migraphx|...` as detectable
- Candidate integrations (to be finalized by research):
  - STT: `whisper.cpp` (`whisper-cli`) with `Vulkan` backend for cross-vendor GPU, CUDA where available.
  - TTS: `piper` (ONNX) with GPU on NVIDIA via CUDA provider; AMD via MIGraphX provider if we can source/build a compatible binary; otherwise CPU fallback.
- Local-only artifacts:
  - Models stored under `VLLM_STUDIO_MODELS_DIR/stt/...` and `VLLM_STUDIO_MODELS_DIR/tts/...`.
- Service manager:
  - “start” for STT/TTS can mean “validate binary exists + warm model cache” (no long-running server required).
  - Apply GPU lease when using GPU backends; strict by default with best-effort retry flow (task-10).

## Tests
- Controller unit tests:
  - request validation + error shaping for `/v1/audio/transcriptions` and `/v1/audio/speech`
  - adapter selection logic (amd/nvidia/unknown)
- Controller integration tests:
  - mocked CLI invocations return expected payloads (text for STT, audio bytes for TTS)
- Frontend unit test: service list renders `stt` and `tts` rows.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- STT/TTS appear as first-class Rock-Em services with health/version in UI.
- Services are local-only (no external dependency required for a basic demo).
- The controller successfully brokers STT/TTS requests to CLI integrations with a stable API contract.
