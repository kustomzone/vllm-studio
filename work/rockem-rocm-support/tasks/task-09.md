<!-- CRITICAL -->
# Task 09 — Rock-Em Service Manager + Capability Registry (Multi-Runtime)

## Objective
Add a minimal “service manager” so vLLM Studio can run and track more than one runtime/service at a time (LLM + STT + TTS + image + video), expose versions/health, and surface this in the UI as “Rock-Em”.

## Files Involved
- New service manager:
  - `controller/src/services/service-manager.ts`
  - `controller/src/services/service-registry.ts`
- New routes:
  - `controller/src/routes/services.ts` (list/start/stop/health/version)
- Types:
  - `controller/src/types/models.ts` (or new `controller/src/types/services.ts`)
- `controller/src/http/app.ts` (register route)
- `controller/src/metrics-collector.ts` (publish service status SSE)
- `frontend/src/lib/types.ts`
- UI:
  - New dashboard “Runtimes” panel
  - Extend `frontend/src/components/dashboard/control-panel/status-line.tsx`
  - Extend `frontend/src/app/configs/_components/configs-view.tsx`

## Changes
Design principle: vLLM Studio remains the control plane, and “Rock-Em” becomes an explicit controller subsystem that manages multiple processes with stable semantics.

- Controller:
  - Create a `ServiceManager` that can manage multiple named services concurrently, each with:
    - `id` (e.g. `llm`, `stt`, `tts`, `image`, `video`)
    - `kind` (e.g. `openai-compatible`, `http-service`, `worker`)
    - `runtime` (e.g. `vllm`, `sglang`, `built-in`)
    - `port`, `pid`, `status`, `version`, `last_error`, `started_at`
  - Add routes:
    - `GET /services` (list service states)
    - `POST /services/:id/start` (start with config payload or named profile)
    - `POST /services/:id/stop`
    - `GET /services/:id/health`
    - `GET /services/:id/version`
  - Emit SSE events:
    - `services` (snapshot)
    - `service_state_changed` (diff)
  - Initial implementation can keep the existing “single inference process” for the `llm` service while enabling parallel services for `stt/tts/image/video`.
  - Keep storage local-only:
    - enforce `VLLM_STUDIO_MODELS_DIR` as the default root for any managed artifacts.
- Frontend:
  - Add a “Runtimes” section:
    - shows Rock-Em services and their statuses
    - shows which runtime is backing each service
  - Replace the current “Voice URL/Model” fields with “STT/TTS service config” or alias them into service profiles.

## Tests
- Controller unit tests:
  - service state machine: start/stop transitions, idempotency, error retention
  - serialization of the `/services` payload
- Integration tests:
  - `/services` returns stopped services on fresh boot
  - starting one service does not stop the others
- Frontend unit tests:
  - “Runtimes” panel renders multiple services and highlights running vs stopped.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- UI can show multiple runtimes concurrently (even if some are stopped).
- Controller can start/stop at least one non-LLM service without disrupting the active LLM backend.
- The API surface is stable enough to hang “Rock-Em indicators” on (platform + services + runtimes).
