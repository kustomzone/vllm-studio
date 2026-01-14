# Task 04 — E2E coverage for recipes, logs, usage, configs, discover

## Objective
Cover remaining primary routes with Playwright specs to ensure the UI renders correctly and responds to key interactions.

## Files Involved
- `frontend/tests/e2e/recipes.spec.ts`
- `frontend/tests/e2e/logs.spec.ts`
- `frontend/tests/e2e/usage.spec.ts`
- `frontend/tests/e2e/configs.spec.ts`
- `frontend/tests/e2e/discover.spec.ts`
- `frontend/src/app/recipes/page.tsx`
- `frontend/src/app/logs/page.tsx`
- `frontend/src/app/usage/page.tsx`
- `frontend/src/app/configs/page.tsx`
- `frontend/src/app/discover/page.tsx`

## Changes
- Add `data-testid` attributes to key controls (filters, refresh buttons, table rows, form fields, sidebar toggles).
- Build Playwright specs that assert:
  - Recipes list loads, selection updates details, and action buttons are visible.
  - Logs page loads sessions and renders filtered log content.
  - Usage page renders stats, charts, and refresh behavior.
  - Configs page displays API settings and service topology blocks.
  - Discover page renders filters and model cards.

## Tests
- `frontend/tests/e2e/*.spec.ts` listed above.

## Validation
- `cd frontend && npx playwright test tests/e2e/recipes.spec.ts`
- `cd frontend && npx playwright test tests/e2e/logs.spec.ts`
- `cd frontend && npx playwright test tests/e2e/usage.spec.ts`
- `cd frontend && npx playwright test tests/e2e/configs.spec.ts`
- `cd frontend && npx playwright test tests/e2e/discover.spec.ts`

## Acceptance Criteria
- Each route has at least one deterministic E2E spec.
- Specs run green using mocked API responses.
