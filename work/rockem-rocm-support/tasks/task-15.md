<!-- CRITICAL -->
# Task 15 — Orchestration + Visibility (Temporal-Backed Workflows)

## Objective
Use Temporal (already present in the repo) to orchestrate multi-service jobs (LLM + STT/TTS + image/video) with reliable state, retries, and UI-visible progress.

## Files Involved
- Controller:
  - `controller/src/services/temporal-status.ts` (existing)
  - New workflows + activities:
    - `controller/src/workflows/*` (new)
    - `controller/src/activities/*` (new)
  - `controller/src/routes/workflows.ts` (new)
  - `controller/src/services/service-manager.ts`
- Frontend:
  - New “Jobs” panel (could live under `frontend/src/app/usage` or a new page)
  - SSE integration to show job progress
- Docs:
  - `docs/orchestration.md`

## Changes
- Define a minimal job model:
  - `job_id`, `type`, `status`, `started_at`, `updated_at`, `progress`, `logs?`
- Implement one “vertical slice” workflow end-to-end:
  - Example: “Voice assistant turn”
    - STT transcribe audio
    - LLM respond (agent-mode tools allowed)
    - TTS speak response
  - Or: “Generate image from prompt” as a background job that acquires GPU lease.
- Expose APIs:
  - `POST /jobs` to start a job
  - `GET /jobs` list
  - `GET /jobs/:id` details
- UI:
  - Show active jobs, progress, errors, and which services are involved.
 - TypeScript only:
   - Workflows/activities are implemented in the Bun controller codebase (no Python workers).

## Tests
- Controller integration tests:
  - start job returns id
  - job progresses through states with mocked activities
- Frontend unit test:
  - jobs panel renders and updates from SSE snapshots

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- At least one multi-service workflow runs with durable progress reporting and shows up in UI.
