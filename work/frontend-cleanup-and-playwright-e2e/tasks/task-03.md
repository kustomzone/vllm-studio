# Task 03 — E2E coverage for chat flow

## Objective
Add Playwright tests that validate core chat behaviors (session list, message send, streaming response, tool panel toggles) with mocked APIs.

## Files Involved
- `frontend/tests/e2e/chat.spec.ts`
- `frontend/src/app/chat/page.tsx`
- `frontend/src/app/chat/components/*`
- `frontend/src/components/chat/*`

## Changes
- Add `data-testid` attributes for chat input, send button, message list, tool panel toggles, and session list items.
- Mock `/api/proxy/chats`, `/api/proxy/chats/:id`, `/api/proxy/v1/models`, and `/api/chat` streaming responses in Playwright fixtures.
- Write a spec that:
  - Loads `/chat` and validates sessions list.
  - Sends a message and verifies assistant response rendering.
  - Toggles tool/artifact panels to ensure UI interactivity.

## Tests
- `frontend/tests/e2e/chat.spec.ts`

## Validation
- `cd frontend && npx playwright test tests/e2e/chat.spec.ts`

## Acceptance Criteria
- Chat E2E tests pass using mocked chat/session responses.
- Chat UI actions are covered without flaky selectors.
