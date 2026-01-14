# Task 00 — Add Playwright E2E infrastructure

## Objective
Introduce Playwright tooling, configuration, and npm scripts so E2E tests can be authored and executed in `frontend/`.

## Files Involved
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/playwright.config.ts`
- `frontend/.gitignore` (if Playwright output dirs are new)

## Changes
- Add `@playwright/test` as a dev dependency and expose scripts such as `test:e2e`, `test:e2e:ui`, `test:e2e:headed`.
- Create `frontend/playwright.config.ts` with:
  - `testDir: 'tests/e2e'`
  - `use.baseURL: 'http://127.0.0.1:3000'`
  - `webServer` to run `npm run dev -- --hostname 127.0.0.1 --port 3000` (or `next dev -H 127.0.0.1 -p 3000`).
  - Consistent artifacts (`trace: 'on-first-retry'`, screenshots/videos on failure).
- Add Playwright output directories to `.gitignore` if not already covered.

## Tests
- No new tests in this task; infra only.

## Validation
- `cd frontend && npm install`
- `cd frontend && npx playwright install --with-deps`
- `cd frontend && npx playwright test --list`

## Acceptance Criteria
- Playwright config loads without errors.
- `npm run test:e2e -- --list` lists tests (even if none yet).
