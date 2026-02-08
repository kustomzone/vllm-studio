<!-- CRITICAL -->
# Task 02 — Add ROCm + Torch Runtime Visibility To `/config`

## Objective
Expose ROCm/HIP and PyTorch build information alongside backend runtime versions, so the UI can show a coherent “what software stack am I on” view for MI300X.

## Files Involved
- `controller/src/services/runtime-info.ts`
- New module: `controller/src/services/rocm-info.ts`
- `controller/src/services/vllm-runtime.ts` (optional: add torch details to vLLM runtime info)
- `controller/src/types/models.ts` (`SystemRuntimeInfo`)
- `controller/src/routes/system.ts` (`/config`)
- `frontend/src/lib/types.ts` (`SystemRuntimeInfo`)
- `frontend/src/app/configs/_components/configs-view.tsx`

## Changes
- Add `getRocmInfo()` and `getTorchInfo()` helpers:
  - ROCm info sources (best effort):
    - `/opt/rocm/.info/version*` if present
    - `rocminfo` output for `gfx*` archs (timeout + safe parsing)
    - `hipcc --version` for HIP version (timeout + safe parsing)
  - Torch info sources:
    - `python -c "import torch; print(torch.__version__); print(torch.version.cuda); print(torch.version.hip)"`
    - Use the same python resolution logic as `getVllmRuntimeInfo()` where possible.
- Update `getSystemRuntimeInfo()` to set:
  - `platform.kind = "rocm"` when ROCm is detected and AMD SMI tool is used.
  - `platform.kind = "cuda"` when `nvidia-smi` works and CUDA versions are non-null.
  - `platform.kind = "unknown"` otherwise.
- Update `frontend` config cards:
  - Render ROCm/HIP + Torch HIP in ROCm mode.
  - Keep existing CUDA driver/runtime cards for CUDA mode.

## Tests
- Unit tests with mocked `spawnSync` for:
  - ROCm detection when `/opt/rocm/.info/version` exists.
  - Torch detection returns hip version on ROCm, cuda version on CUDA.
- Frontend unit test: Config card selects ROCm labels in ROCm mode.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- `/config` includes `runtime.platform` + `runtime.rocm` + `runtime.torch` (names may vary per task-00 decision).
- Config UI shows ROCm/HIP values on ROCm hosts instead of blank CUDA fields.
