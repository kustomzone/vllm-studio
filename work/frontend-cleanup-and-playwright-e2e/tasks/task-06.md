# Task 06 — Refactor layout and navigation to use primitives

## Objective
Standardize layout and navigation styling using the new tokens and UI primitives.

## Files Involved
- `frontend/src/app/layout.tsx`
- `frontend/src/components/app-sidebar.tsx`
- `frontend/src/components/nav.tsx`
- `frontend/src/components/command-palette.tsx`
- `frontend/src/components/chat/theme-toggle.tsx`

## Changes
- Replace inline hex styles with token-based classes and UI primitives.
- Extract repeated nav button styles into shared components.
- Add `data-testid` attributes for nav links and sidebar toggles (supporting E2E).
- Align theme toggle’s CSS variable updates with the standardized token set.

## Tests
- Add integration tests for `AppSidebar` and nav primitives (Testing Library).
- Ensure existing Vitest tests still pass.

## Validation
- `cd frontend && npm run test`
- `cd frontend && npm run lint`

## Acceptance Criteria
- Navigation styles are consistent and rely on tokens.
- Sidebar behavior unchanged; E2E selectors remain stable.
