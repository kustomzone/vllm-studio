# Task 02 — E2E coverage for navigation + dashboard

## Objective
Validate global navigation and dashboard status rendering with deterministic mocks.

## Files Involved
- `frontend/tests/e2e/dashboard.spec.ts`
- `frontend/src/components/app-sidebar.tsx`
- `frontend/src/app/page.tsx`

## Changes
- Add `data-testid` hooks for:
  - Sidebar navigation items (dashboard/chat/recipes/logs/usage/configs/discover).
  - Dashboard status banner and metrics grid.
  - Quick launch search input and logs panel.
- Implement Playwright spec that:
  - Visits `/` and verifies sidebar links render.
  - Confirms mocked status (running model, GPU stats, metrics) renders on the dashboard.
  - Validates navigation to another route and back.

## Tests
- `frontend/tests/e2e/dashboard.spec.ts`

## Validation
- `cd frontend && npx playwright test tests/e2e/dashboard.spec.ts`

## Acceptance Criteria
- Dashboard E2E test passes using mocked data.
- Navigation links are stable via `data-testid` attributes.
