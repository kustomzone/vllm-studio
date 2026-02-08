<!-- CRITICAL -->
# Scope: First-class ROCm (Rock-Em) support

## Goal
Add first-class support for the ROCm ("Rock-Em") community to vLLM Studio so an AMD Instinct MI300X host feels as “native” as a CUDA host:

1. Correct GPU visibility, metrics, and telemetry on ROCm hosts.
1. Clear runtime/platform versioning and compatibility visibility (ROCm/HIP, PyTorch, vLLM/SGLang/llama.cpp).
1. UI indicators that explicitly communicate platform (ROCm vs CUDA), backend runtime (vLLM/SGLang/llama.cpp), and what is currently running.
1. A pragmatic path to real VLM usage (image attachments actually passed through to inference) plus a staged plan for additional modalities (STT/TTS/image/video) without turning the controller into an unmaintainable monolith.
1. All new features (STT/TTS/image/video/orchestration/control-plane) are implemented in **TypeScript** inside the Bun controller. No Python workers/services. External binaries may be executed as managed child processes.

## Context
- We are provisioning `1x MI300X VM` and want vLLM Studio to operate cleanly on ROCm.
- Current setup is “messy” in the sense that the UI does not provide sufficient visibility into the software layer between hardware and inference runtimes (ROCm/HIP vs CUDA; driver/runtime versions; torch build; compatibility checks).
- “Rock-Em” is assumed to mean **ROCm** (AMD’s compute software stack; often pronounced “rock ’em”).

## Current Provisioned Environment (As Of 2026-02-08)
- Provider: Hot Aisle
- VM: `enc1-gpuvm002` (`1x MI300X VM`)
- SSH: `ssh hotaisle@23.183.40.67`
- OS: Ubuntu 22.04.5 LTS
- ROCm: `7.1.1` (`/opt/rocm/.info/version`)
- GPU: AMD Instinct MI300X VF, `gfx942`
- GPU tooling present:
  - `amd-smi` available (reports ROCm version and GPU info)
  - `rocm-smi`, `rocminfo`, `hipcc` available
- Controller bootstrap on VM:
  - Bun installed via `https://bun.sh/install`
  - `~/vllm-studio/controller` dependencies installed
  - Controller started (background) on port `8080` (local reachability verified)
- Networking note:
  - UFW default denies incoming except `22/tcp`; controller is not reachable directly from the public IP without opening ports.
  - Preferred workflow for now: SSH port-forward to access controller/UI during bring-up.

## Current State (What Exists)
**Backend architecture**

- Controller is Bun + Hono, entrypoint `controller/src/main.ts`.
- The controller owns model lifecycle via recipes and a single inference port.
  - Recipes -> argv command builder:
    - `controller/src/services/backends.ts`
    - Recipe schema normalization and persistence described in `docs/RECIPE_SYSTEM.md`
  - Process orchestration:
    - `controller/src/services/process-manager.ts` launches one backend on `VLLM_STUDIO_INFERENCE_PORT` (default 8000)
    - `controller/src/services/process-utilities.ts` sets env vars (currently CUDA-oriented)
- “OpenAI-compatible” API:
  - `/v1/models` and `/v1/chat/completions` are implemented by `controller/src/routes/models.ts` and `controller/src/routes/openai.ts`
  - `/v1/chat/completions` can trigger **model switching** based on the requested `model` field (`controller/src/routes/openai.ts`)
- Health, config, runtime versions:
  - `/health`, `/status`, `/gpus`, `/config` in `controller/src/routes/system.ts`
  - Runtime versions are assembled in `controller/src/services/runtime-info.ts` (vLLM/SGLang/llama.cpp + CUDA info)
- Telemetry and UI live updates:
  - Controller emits SSE at `/events` (`controller/src/routes/logs.ts`)
  - Background collector publishes `status`, `gpu`, `metrics`, `temporal_status` (`controller/src/metrics-collector.ts`)

**GPU telemetry is CUDA-only**

- GPU info is fetched from `nvidia-smi` only: `controller/src/services/gpu.ts`.
- Controller startup runs a CUDA-specific accessibility check (`nvidia-smi`), warning otherwise: `controller/src/main.ts`.
- Runtime “hardware” info is CUDA-focused:
  - `controller/src/services/runtime-info.ts` includes `getCudaInfo()` which calls `nvidia-smi` / `nvcc`.

**Frontend**

- Next.js app in `frontend/`.
- System Configuration page already shows:
  - Backend versions (vLLM/SGLang/llama.cpp)
  - GPU count/types
  - CUDA driver/runtime (currently `Unknown` on ROCm)  
  via `frontend/src/app/configs/_components/configs-view.tsx`.
- Dashboard shows GPU status cards, but those depend on controller emitting GPU telemetry from `getGpuInfo()` (currently empty on ROCm).

**Chat/VLM status (important gap)**

- The chat UI has attachment pickers and uploads attachments into AgentFS, but it does **not** send actual multimodal message parts to inference today:
  - `frontend/src/app/chat/_components/layout/chat-page.tsx` adds placeholder text like `[Image: name]`
  - No evidence of `image_url` or other OpenAI multimodal content mapping in controller agent runtime (`controller/src/services/agent-runtime/*`).

## Target State (What Changes)
**Platform-aware, vendor-neutral hardware layer**

- Replace “CUDA-only” assumptions with a platform abstraction that supports:
  - `cuda` (NVIDIA)
  - `rocm` (AMD)
  - `unknown` (fallback; still functional but no GPU metrics)
- GPU telemetry (memory/util/temp/power) works on ROCm hosts via `amd-smi` or `rocm-smi` parsing, with robust fallbacks.

**Runtime + compatibility visibility**

- `/config` returns both runtime versions and the platform layer versions:
  - ROCm: ROCm version, HIP runtime/compiler version, GPU arch (gfx*), driver/kernel hints.
  - CUDA: driver + runtime version (existing).
  - Both: PyTorch version + backend build flavor (CUDA vs ROCm), vLLM/SGLang versions, llama.cpp binary + build flavor if detectable.
- UI surfaces:
  - a clear “Platform: ROCm” indicator in the dashboard/status line.
  - a “Compatibility” panel that makes mismatches obvious (e.g. PyTorch ROCm version does not match installed ROCm runtime; vLLM missing/installed; GPU tool missing).

**Recipe/env correctness on ROCm**

- Device selection supports ROCm environment variables:
  - `HIP_VISIBLE_DEVICES`, `ROCR_VISIBLE_DEVICES` (and optionally keep `CUDA_VISIBLE_DEVICES` for CUDA).
- UI clarifies which env vars are being applied for a running recipe, and why.

**VLM enablement**

- Add a feature-flagged path where images selected in the UI are sent as actual multimodal content to inference when the selected model/backend supports it.
- Primary requirement: VLM works through the **agent runtime** (`/chats/:id/turn`) so tools/agent-mode remain available for VLM sessions.
- Keep a “direct OpenAI path” as a fallback implementation (useful for bring-up and isolating agent-runtime limitations).

**Modalities (STT/TTS/image/video)**

- Treat modalities as first-class **services** managed by Rock-Em (processes started/stopped and health-checked by the controller), not a loose collection of external URLs.
- Provide a service registry (STT/TTS/image/video) that can:
  - start/stop services locally on the VM
  - report versions/health
  - expose capabilities to the UI and to agent tools via stable internal APIs

**Constraints**

- Keep existing OpenAI-compatible endpoints stable.
- Preserve the current “single active LLM backend” behavior as the default, but allow additional services to run concurrently on their own ports.
- Any multi-runtime / multi-port orchestration (especially multiple LLM runtimes active at once) should be introduced behind feature flags and phased in.

## Integration Plan
### Phase 0 — VM + Controller Bring-Up (Now)
1. Provision `1x MI300X VM`.
1. Install Bun and boot the controller on the VM.
1. Use SSH port-forwarding for safe access during early bring-up.

### Phase 1 — ROCm First-Class Visibility (Unblock Everything Else)
1. Introduce a platform detection + hardware telemetry module in the controller.
1. Extend controller types and `/config` payloads to include ROCm platform info and torch build info.
1. Update telemetry and warnings to be platform-aware (don’t warn about missing `nvidia-smi` on AMD).
1. Update the frontend to surface platform and compatibility indicators in a single obvious place (dashboard status line + config page).

### Phase 2 — Rock-Em Services + Concurrency Semantics
1. Introduce a Rock-Em service manager for multi-runtime visibility (LLM + STT + TTS + image + video).
1. Implement strict GPU lease + “best-effort retry” flow for conflicting services (controller + UI).

### Phase 3 — Modalities As Integrations (CLI-driven, Controller-Brokered)
1. STT integration (`/v1/audio/transcriptions`) via a CLI adapter.
1. TTS integration (`/v1/audio/speech`) via a CLI adapter (CPU-first baseline, optional GPU where available).
1. Image integration (`/v1/images/generations`) via a CLI adapter.

### Phase 4 — VLM (Vision-Language) End-to-End
1. Feature-flagged multimodal message support (image parts) for the agent runtime path (`/chats/:id/turn`), plus a “direct OpenAI” fallback path for bring-up and backend capability detection.
1. UI indicators for “VLM enabled” and per-backend capability reporting.

### Phase 5 — Operationalization
1. ROCm-focused operational docs for provisioning and “what to check first”.
1. Basic deployment story (systemd unit or docker compose on the VM), secrets handling, and upgrade workflow.

## Testing Plan
**Controller**

- Unit tests:
  - Parse `amd-smi` and/or `rocm-smi` outputs into the existing `GpuInfo` shape.
  - Platform detection logic.
  - Env var builder behavior for ROCm (`HIP_VISIBLE_DEVICES`, `ROCR_VISIBLE_DEVICES`) and CUDA (`CUDA_VISIBLE_DEVICES`).
- Integration tests:
  - `/config` returns a coherent platform section for mocked ROCm and mocked CUDA environments.
  - SSE payload for `gpu` events contains ROCm GPU info when present.

**Frontend**

- Unit tests (Vitest + JSDOM):
  - Platform indicator rendering from `/config` payload.
  - Compatibility panel states (pass/warn/fail).
- E2E tests (Playwright):
  - Config page loads and displays ROCm fields when backend returns them.
  - Dashboard shows “Platform: ROCm” indicator when configured.

**Coverage**

- 100% for newly introduced parsing/platform modules, plus any new UI compatibility components.

## Non-goals
- Replacing Bun/Hono, Temporal, or the recipe system.
- Implementing multi-node (distributed) training orchestration.
- Shipping a fully-managed “model zoo installer” inside the controller (we will instead build integration points and a staged installation playbook).
- Solving ROCm kernel-level issues; we focus on detection, visibility, and correct orchestration.

## Risks & Mitigations
- ROCm tooling variance (`amd-smi` vs `rocm-smi`, differing output formats).
  - Mitigation: support multiple tools with robust parsing and golden-file unit tests.
- Multimodal support may diverge across backends (vLLM vs SGLang vs llama.cpp).
  - Mitigation: feature-flag per backend; start with the simplest supported path; add capability probing.

## Assumptions
- “Rock-Em” refers to **ROCm**, not a separate product with its own API.
- Controller and UI are operated against the **VM** (the VM is the primary execution environment).
- Target is **ROCm across AMD GPUs**, not only MI300X.
- Multi-runtime concurrency is a requirement: the system must be able to track and report more than one runtime/service at a time.
- Models and artifacts are stored **locally on the VM only** (no shared model store requirement).
- No licensing constraints beyond what the operator is willing to run.
- We will treat multimodal (VLM) support as “image + text chat” first; other modalities are exposed as separate services with explicit health/version visibility.
- For runtime concurrency conflicts (VRAM/GPU contention), the default policy is **strict GPU lease** (one lease holder at a time) with an explicit UI affordance to retry in **best-effort** mode (may fail/OOM).
