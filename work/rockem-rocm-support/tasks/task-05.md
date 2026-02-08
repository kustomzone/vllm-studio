<!-- CRITICAL -->
# Task 05 — Compatibility Matrix Endpoint + UI Panel

## Objective
Provide a single place to answer “why isn’t this working” by implementing a compatibility/visibility report (platform + runtime + tool availability + recommended fixes), then surfacing it in the UI.

## Files Involved
- `controller/src/services/runtime-info.ts`
- New module: `controller/src/services/compatibility-report.ts`
- `controller/src/routes/system.ts` (add `GET /compat` or include in `/config`)
- `frontend/src/app/configs/_components/configs-view.tsx` (add “Compatibility” section)
- New UI component: `frontend/src/components/compatibility/compatibility-panel.tsx`

## Changes
- Build a compatibility report that returns:
  - `platform.kind`
  - `gpu_monitoring.available` and `gpu_monitoring.tool`
  - `torch` build flavor (CUDA vs HIP vs CPU)
  - `vllm` installed + version
  - `sglang` installed + version
  - `llamacpp` installed + version
  - A list of `checks[]` each with:
    - `id`, `severity` (`info|warn|error`), `message`, `evidence`, `suggested_fix`
- Important checks:
  - ROCm platform but torch has no `torch.version.hip`
  - ROCm platform but no `amd-smi`/`rocm-smi`
  - CUDA platform but no `nvidia-smi`
  - vLLM installed but `vllm` binary missing (path issues)
  - Inference port in use by unknown process
- UI panel:
  - Render checks grouped by severity.
  - Provide copy-pastable “fix commands” snippets.

## Tests
- Controller unit tests for check generation (table-driven).
- Frontend unit tests for rendering severity groups.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- A user can open Config and immediately see why GPU telemetry or vLLM is unavailable, with actionable fix steps.
- Report is stable and does not leak secrets (no env var dumps, no API keys).
