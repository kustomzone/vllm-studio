# Task 08 — Modularize usage, configs, logs, and discover pages

## Objective
Refactor remaining non-chat pages into smaller modules and align them with standardized styling.

## Files Involved
- `frontend/src/app/usage/page.tsx`
- `frontend/src/app/configs/page.tsx`
- `frontend/src/app/logs/page.tsx`
- `frontend/src/app/discover/page.tsx`
- `frontend/src/app/usage/components/*` (new)
- `frontend/src/app/configs/components/*` (new)
- `frontend/src/app/logs/components/*` (new)
- `frontend/src/app/discover/components/*` (new)

## Changes
- Extract header sections, filters, tables/cards, and summary blocks into components.
- Replace repeated styling with UI primitives and tokenized classes.
- Keep data-loading logic in the page-level component and reuse common UI pieces.

## Tests
- Integration tests for newly extracted components.
- Ensure E2E specs for usage/configs/logs/discover remain green.

## Validation
- `cd frontend && npm run test`
- `cd frontend && npx playwright test tests/e2e/usage.spec.ts`
- `cd frontend && npx playwright test tests/e2e/configs.spec.ts`
- `cd frontend && npx playwright test tests/e2e/logs.spec.ts`
- `cd frontend && npx playwright test tests/e2e/discover.spec.ts`

## Acceptance Criteria
- Each page is composed of smaller, testable components.
- Styling is consistent with the new design tokens.
