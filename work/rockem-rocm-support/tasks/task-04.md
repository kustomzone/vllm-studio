<!-- CRITICAL -->
# Task 04 — Platform-Aware Warnings + Dashboard Indicator

## Objective
Stop emitting misleading `nvidia-smi` warnings on ROCm, and add a clear platform indicator to the main dashboard status line (ROCm vs CUDA).

## Files Involved
- `controller/src/main.ts`
- `controller/src/services/gpu.ts` (or new platform helper from task-01)
- `frontend/src/components/dashboard/control-panel/status-line.tsx`
- `frontend/src/components/dashboard/use-dashboard-data.ts` (if it needs to pull `/config` runtime info)
- `frontend/src/lib/types.ts`

## Changes
- Replace `checkNvidiaSmi()` in `controller/src/main.ts` with a more general check:
  - If CUDA platform: check `nvidia-smi`.
  - If ROCm platform: check `amd-smi` or `rocm-smi`.
  - If unknown: don’t warn loudly; just note GPU monitoring may be unavailable.
- Extend dashboard data fetching so the status line can read the platform kind:
  - Simplest: dashboard fetches `/config` once and stores `runtime.platform.kind` in state.
  - Avoid extra polling; subscribe to SSE for fast-moving metrics, but treat platform as slowly changing.
- Update `frontend/src/components/dashboard/control-panel/status-line.tsx` to show:
  - `platform: rocm` or `platform: cuda` as a small monospace chip near backend/PID.

## Tests
- Frontend unit test: status line renders `platform: rocm` when passed that runtime info.

## Validation
```bash
cd controller && bun run typecheck
cd ../frontend && npm run build && npm test
```

## Acceptance Criteria
- On ROCm hosts, controller startup does not show the CUDA-specific warning.
- Dashboard shows an explicit platform label in the primary status line.
