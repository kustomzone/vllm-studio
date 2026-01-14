# Task 05 — Define design tokens and UI primitives

## Objective
Introduce shared design tokens and reusable UI primitives to standardize styling and reduce inline hex usage.

## Files Involved
- `frontend/src/app/globals.css`
- `frontend/src/components/ui/*` (new)
- `frontend/src/lib/cn.ts` (new helper for class merging)
- `frontend/src/test/setup.ts` (new)
- `frontend/vitest.config.ts`
- `frontend/package.json` (Testing Library deps if required)

## Changes
- Add or refine CSS variables/tokens in `globals.css` (surface, border, text, accent, status colors).
- Create UI primitives (e.g., `Button`, `IconButton`, `Card`, `Badge`, `Input`, `Table`, `SectionHeader`) that map to tokens.
- Provide a class helper (`cn`) and optional Tailwind merge support if needed.
- Add Testing Library + jest-dom setup for component integration tests.

## Tests
- Unit tests for `cn` helper and any formatting utilities.
- Integration tests for core UI primitives (button, card, input, badge) using Testing Library.

## Validation
- `cd frontend && npm run test`
- `cd frontend && npm run lint`

## Acceptance Criteria
- New primitives render with standardized styles and tokens.
- Inline hex usage can be reduced by adopting primitives.
- Component tests pass and cover new UI modules.
