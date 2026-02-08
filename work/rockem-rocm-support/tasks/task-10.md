<!-- CRITICAL -->
# Task 10 — GPU Lease + Best-Effort Retry UX (Strict By Default)

## Objective
Implement a strict GPU-lease policy for conflicting services (cannot run concurrently), with a clear UI error that offers a best-effort retry option.

## Files Involved
- Controller:
  - New module: `controller/src/services/gpu-lease.ts`
  - `controller/src/services/service-manager.ts` (from task-09)
  - `controller/src/routes/services.ts`
  - `controller/src/services/gpu.ts` (for VRAM snapshots, best-effort messaging)
- Frontend:
  - New component: `frontend/src/components/runtimes/gpu-lease-modal.tsx`
  - “Runtimes” panel (task-09)
  - `frontend/src/lib/api.ts` (start/stop service calls)

## Changes
### Controller API
- Add a lease model:
  - One active lease holder per GPU (start with “one GPU in VM” assumption; design API for N GPUs).
  - Lease has `holder_service_id`, `acquired_at`, optional `reason`.
- Service start semantics:
  - `POST /services/:id/start` accepts `{ mode: "strict" | "best_effort" }`.
  - In `strict` mode:
    - if lease is held by another service, return `409 Conflict` with a structured payload:
      - `code: "gpu_lease_conflict"`
      - `requested_service`, `holder_service`, `recommended_actions[]`
  - In `best_effort` mode:
    - attempt start anyway; if it fails (OOM/exit), capture logs and return a clear error that it likely failed due to contention.
- Provide a convenience action:
  - `POST /services/:id/start?replace=1` (or body `replace: true`) that stops the current lease holder and then starts requested service (explicit user action in UI).

### Frontend UX
- When start returns `gpu_lease_conflict`:
  - show a modal that explains:
    - which service currently holds the GPU
    - what will happen if the user chooses “best-effort”
  - offer buttons:
    - “Stop <holder> and start <requested>” (replace)
    - “Try best-effort start anyway”
    - “Cancel”
- Always surface current lease holder in the “Runtimes” panel.

## Tests
- Controller unit tests:
  - lease acquisition/release logic
  - `strict` conflict shaping
  - `replace` flow stops holder then starts requested (mock service start)
- Frontend unit tests:
  - modal renders conflict details and triggers correct API calls on button clicks

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- Starting a conflicting service fails in strict mode with a clear conflict payload.
- UI displays a clear error/modal and allows the user to explicitly choose replace or best-effort.
