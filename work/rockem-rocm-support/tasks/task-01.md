<!-- CRITICAL -->
# Task 01 — Implement ROCm GPU Telemetry (amd-smi / rocm-smi)

## Objective
Make `/gpus`, `/metrics`, and SSE `gpu` events work on ROCm machines by collecting GPU telemetry from AMD tooling, with deterministic parsing and fallbacks.

## Files Involved
- `controller/src/services/gpu.ts`
- `controller/src/types/models.ts` (`GpuInfo`)
- `controller/src/metrics-collector.ts`
- `controller/src/routes/system.ts` (`/gpus`)
- New module: `controller/src/services/amd-gpu.ts` (or `controller/src/services/gpu-amd.ts`)
- New tests: `controller/src/services/amd-gpu.test.ts`

## Changes
- Refactor `controller/src/services/gpu.ts` into a thin orchestrator:
  - If `nvidia-smi` is available, use current implementation.
  - Else if `amd-smi` is available, parse its output into `GpuInfo[]`.
  - Else if `rocm-smi` is available, parse its output into `GpuInfo[]`.
  - Else return `[]`.
- Keep `GpuInfo` stable if possible; if AMD tools cannot report certain fields, return `0` / `null` consistently (pick one, document in code, and keep UI resilient).
- Add env overrides:
  - `VLLM_STUDIO_GPU_SMI_TOOL=nvidia-smi|amd-smi|rocm-smi` (optional force)
  - `NVIDIA_SMI_PATH` already exists; add `AMD_SMI_PATH` and `ROCM_SMI_PATH` symmetry.
- Ensure metrics collector continues to run even when GPU tools are missing.

## Tests
- Unit tests for the AMD parser:
  - Golden-file tests for 1 GPU output (MI300X).
  - Verify unit conversions (MiB to bytes) match `GpuInfo` expectations.
  - Verify missing fields degrade gracefully.
- Integration test:
  - Mock `execSync` and validate `getGpuInfo()` selects the expected tool based on availability.

## Validation
```bash
cd controller
bun run typecheck
bun test
```

## Acceptance Criteria
- On ROCm hosts, `GET /gpus` returns `count > 0` and `gpus[].name` contains the AMD GPU name.
- SSE emits `gpu` events with the same shape as CUDA machines.
- Prometheus `/metrics` includes GPU memory/utilization gauges updated from AMD telemetry when available.
