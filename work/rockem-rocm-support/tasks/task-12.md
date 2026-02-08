<!-- CRITICAL -->
# Task 12 — End-to-End Validation And Regression Coverage

## Objective
Add a thin but meaningful E2E suite that proves the ROCm support and visibility features behave as expected, and prevents regressions.

## Files Involved
- `frontend/playwright.config.*` (if exists)
- New Playwright tests under `frontend/tests/` or `frontend/src/__tests__/e2e/` (follow repo conventions)
- Controller route tests under `controller/src/routes/*.test.ts`

## Changes
- Add Playwright tests that run against a mocked backend or a lightweight local controller:
  - Config page shows ROCm fields when `/config` returns ROCm payload.
  - Dashboard shows `platform: rocm` chip.
  - Compatibility panel renders warnings/errors deterministically.
- Add controller tests that validate:
  - `/config` includes platform fields.
  - `/gpus` returns AMD GPU info for mocked SMI output.
- Keep tests hermetic:
  - Do not require a real GPU in CI.
  - Use fixture JSON responses or mocked command execution.

## Tests
- `cd frontend && npm run test:integration`
- `cd controller && bun test`

## Validation
```bash
cd controller && bun run typecheck && bun test
cd ../frontend && npm run build && npm run lint && npm test && npm run test:integration
```

## Acceptance Criteria
- ROCm support is covered by at least one controller test and one UI-level test.
- The suite is stable and does not depend on timing-sensitive SSE behavior.
