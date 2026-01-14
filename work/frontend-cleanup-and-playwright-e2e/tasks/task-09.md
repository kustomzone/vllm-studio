# Task 09 — Modularize and clean up the recipes page

## Objective
Split the large recipes page into clear sections and standardize styling with shared primitives.

## Files Involved
- `frontend/src/app/recipes/page.tsx`
- `frontend/src/app/recipes/components/*` (new)
- `frontend/src/lib/recipe-command.ts` (only if refactor needs helper extraction)

## Changes
- Extract sidebar list, model browser, recipe editor, command preview, and VRAM calculator into components.
- Replace inline hex classes with token-based primitives.
- Preserve existing logic for saving, launching, and deleting recipes.

## Tests
- Integration tests for extracted components (editor, list, and VRAM calculator).
- Ensure recipes E2E spec remains green.

## Validation
- `cd frontend && npm run test`
- `cd frontend && npx playwright test tests/e2e/recipes.spec.ts`

## Acceptance Criteria
- `recipes/page.tsx` reads as an orchestration layer with smaller components.
- Styling is consistent and uses shared primitives.
