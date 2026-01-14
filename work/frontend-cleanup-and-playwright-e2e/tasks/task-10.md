# Task 10 — Modularize chat page and unify chat styling

## Objective
Refactor chat page/layout into smaller modules and align chat components with the new design system while preserving behavior.

## Files Involved
- `frontend/src/app/chat/page.tsx`
- `frontend/src/app/chat/components/*`
- `frontend/src/components/chat/*`
- `frontend/src/app/chat/utils/*`

## Changes
- Extract large logical sections (header, message list, composer, side panel) into discrete components with clear props.
- Replace inline hex styles with token-based primitives and shared components.
- Add/standardize `data-testid` attributes used by chat E2E tests.
- Keep API interactions and state orchestration in the top-level page.

## Tests
- Integration tests for new chat components (message list, composer, panels).
- Ensure chat E2E spec stays green after refactor.

## Validation
- `cd frontend && npm run test`
- `cd frontend && npx playwright test tests/e2e/chat.spec.ts`

## Acceptance Criteria
- Chat UI is modular, easier to navigate, and uses standardized styling.
- No regressions in chat interactions or E2E coverage.
