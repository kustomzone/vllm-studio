# Task 01 — Build Playwright fixtures and API mocks

## Objective
Create deterministic E2E fixtures and a reusable mock layer for `/api/proxy/*` and local `/api/*` routes used by the frontend.

## Files Involved
- `frontend/tests/e2e/fixtures/*.json`
- `frontend/tests/e2e/utils/mock-api.ts`
- `frontend/tests/e2e/utils/test-data.ts`
- `frontend/tests/e2e/utils/storage-state.json` (if needed for localStorage)

## Changes
- Capture representative fixture payloads for:
  - `/api/proxy/health`, `/api/proxy/status`, `/api/proxy/gpus`, `/api/proxy/metrics`
  - `/api/proxy/recipes`, `/api/proxy/recipes/:id`, `/api/proxy/chats`, `/api/proxy/logs`
  - `/api/proxy/usage`, `/api/proxy/peak-metrics`
  - `/api/proxy/v1/models`
- Add a `mockApi(page)` helper that registers `page.route` handlers and returns fixtures based on URL/method.
- Add a `seedLocalStorage(page)` helper for user prefs (theme, pinned recipes, sidebar state).
- Ensure mock responses match the shapes defined in `frontend/src/lib/types.ts`.

## Tests
- Optional: add a small Playwright “smoke” spec that uses the mock helper to confirm routing works.

## Validation
- `cd frontend && npx playwright test --list`
- `cd frontend && npx playwright test tests/e2e/smoke.spec.ts` (if added)

## Acceptance Criteria
- Mock helper serves consistent responses for all primary API endpoints.
- Fixtures are centralized and reusable by all E2E specs.
