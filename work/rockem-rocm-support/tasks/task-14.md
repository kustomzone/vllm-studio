<!-- CRITICAL -->
# Task 14 — Image Generation Integration (CLI-Driven, Cross-Vendor GPU When Available)

## Objective
Provide image generation as a **Rock-Em-managed integration** where the controller (Bun/TypeScript) brokers requests and lifecycle, but an external CLI component performs the accelerated inference. Prefer a solution that can run on both NVIDIA and AMD GPUs (or has vendor-specific backends behind a stable CLI contract).

## Files Involved
- Controller:
  - `controller/src/services/service-manager.ts` (service definition for `image`)
  - New integration adapter:
    - `controller/src/services/integrations/image/*`
  - New routes:
    - `controller/src/routes/images.ts` (OpenAI-style image endpoint(s))
  - `controller/src/services/gpu-lease.ts` (from task-10)
- Frontend:
  - “Runtimes” panel (task-09)
  - A simple “Generate Image” UI entry point (could live under `frontend/src/app/chat` toolbelt or a new page)
- Docs:
  - `docs/image-generation.md`

## Changes
- Implement an OpenAI-style image generation endpoint in the controller:
  - `POST /v1/images/generations`
  - This endpoint selects an image integration adapter and invokes an external CLI tool, returning either:
    - Base64 image payloads (OpenAI-like), or
    - A URL/file reference to an artifact stored under the local artifacts directory (prefer: local-only + UI can preview).
- Integration adapter contract:
  - `isInstalled()`, `getVersion()`, `listModels()`
  - `generate({ prompt, negativePrompt?, width, height, steps, seed?, modelId?, outputFormat? })`
  - `getBackends()` reporting `cpu|cuda|vulkan|hipblas|opencl|...` as detectable
- Primary candidate integration (to finalize during implementation research):
  - `stable-diffusion.cpp` via `sd-cli`:
    - Has a CLI-oriented workflow suitable for controller brokering.
    - Supports multiple acceleration backends (CUDA, Vulkan, etc.) and is active/modern. (Use Vulkan for cross-vendor; use CUDA on NVIDIA; use HIP/hipBLAS on ROCm when available.)
- Local-only artifacts and models:
  - Models under `VLLM_STUDIO_MODELS_DIR/image/...`
  - Outputs under `VLLM_STUDIO_ARTIFACTS_DIR/image/...` (or existing artifacts dir conventions)
- Concurrency with LLM and other GPU services:
  - Acquire the GPU lease before invoking GPU-backed generation in strict mode.
  - If lease conflict: return structured `gpu_lease_conflict` and let the UI offer:
    - “Stop holder and run image generation”
    - “Best-effort run anyway” (explicitly warns of OOM / failure)
    - “Cancel”

## Tests
- Controller unit tests: lease logic and error shaping.
- Controller unit tests:
  - request validation + error shaping for `/v1/images/generations`
  - adapter selection logic (amd/nvidia/unknown)
- Controller integration tests:
  - mocked CLI invocations return a deterministic fake PNG and the route returns a correct OpenAI-like response
- Frontend unit test: image generation panel renders and shows service status.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- Image service appears as a first-class Rock-Em service with health/version in UI.
- The controller can generate an image through the integration on a real host (manual validation) and through mocks in CI.
- The system has a clear, user-visible story for “why image generation can’t start right now” (GPU lease conflict), with a strict-by-default policy and an explicit best-effort override.
