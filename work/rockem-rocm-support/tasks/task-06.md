<!-- CRITICAL -->
# Task 06 — Runtime/Platform Eventing (SSE) + UI Sync

## Objective
Ensure platform/runtime changes (vLLM upgrade, ROCm detection, GPU monitoring availability) are visible in the UI without manual refresh, by emitting structured SSE events and handling them in the frontend.

## Files Involved
- `controller/src/services/event-manager.ts`
- `controller/src/metrics-collector.ts`
- `controller/src/routes/runtime.ts` (already emits `runtime_vllm_upgraded`)
- New route (optional): `controller/src/routes/runtime.ts` add `GET /runtime/summary`
- `frontend/src/hooks/use-controller-events.ts`
- `frontend/src/store/*` (where realtime status is stored)

## Changes
- Add a periodic SSE event (low frequency, e.g. 30s) for `runtime_summary` containing:
  - platform kind
  - runtime versions (vLLM/SGLang/llama.cpp)
  - gpu monitoring available/tool
- Alternatively, publish a `runtime_summary` event whenever:
  - controller boots
  - vLLM runtime is upgraded
  - platform detection changes (rare)
- Update `useControllerEvents` to:
  - route `runtime_summary` into the same realtime store as `status/gpu/metrics`
  - trigger UI re-render of platform indicator and compatibility panel

## Tests
- Controller integration test for SSE stream emits `runtime_summary` at least once (mock timer).
- Frontend unit test for `useControllerEvents` dispatching the custom event for `runtime_summary`.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- UI updates platform/runtime indicators after vLLM upgrades without requiring a full page refresh.
