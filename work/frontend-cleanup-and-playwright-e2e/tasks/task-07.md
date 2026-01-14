# Task 07 — Modularize and restyle the dashboard

## Objective
Break the dashboard into smaller components and standardize styling with shared primitives.

## Files Involved
- `frontend/src/app/page.tsx`
- `frontend/src/app/dashboard/components/*` (new) or `frontend/src/components/dashboard/*`

## Changes
- Extract components (metrics grid, GPU table/cards, quick launch search, logs panel, stats column) into dedicated files.
- Replace inline hex classes with token-based primitives (`Card`, `Badge`, `SectionHeader`, etc.).
- Keep data-fetch logic in the page component; move presentational logic into child components.

## Tests
- Integration tests for new dashboard components with Testing Library.
- Ensure dashboard E2E spec remains green.

## Validation
- `cd frontend && npm run test`
- `cd frontend && npx playwright test tests/e2e/dashboard.spec.ts`

## Acceptance Criteria
- Dashboard is modularized into readable components.
- Visual output matches existing behavior with standardized styles.
