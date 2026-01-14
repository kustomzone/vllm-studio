# Scope: Frontend cleanup and Playwright E2E

## Goal
Deliver a clean, modularized frontend with standardized styling and a Playwright E2E suite that covers critical user flows, while keeping existing functionality intact.

## Context
The frontend UI behaves correctly but is difficult to maintain due to inconsistent styling, large monolithic page components, and limited automated end-to-end coverage. The requested order is Playwright E2E tests first, then modularization/cleanup.

## Current State (What Exists)
- Next.js app in `frontend/src/app` with top-level routes:
  - Dashboard: `frontend/src/app/page.tsx`
  - Chat: `frontend/src/app/chat/page.tsx` + local components in `frontend/src/app/chat/components`
  - Recipes: `frontend/src/app/recipes/page.tsx`
  - Logs: `frontend/src/app/logs/page.tsx`
  - Usage: `frontend/src/app/usage/page.tsx`
  - Configs: `frontend/src/app/configs/page.tsx`
  - Discover: `frontend/src/app/discover/page.tsx`
- Shared layout & navigation:
  - `frontend/src/app/layout.tsx` wraps pages with `frontend/src/components/app-sidebar.tsx`.
  - `frontend/src/components/nav.tsx` (command palette and secondary nav patterns).
- Styling patterns:
  - Global CSS variables and many bespoke rules in `frontend/src/app/globals.css`.
  - Heavy use of inline Tailwind classes with hard-coded hex colors across pages and chat components.
  - `frontend/src/components/chat/theme-toggle.tsx` mutates CSS variables directly.
- API integration:
  - `frontend/src/lib/api.ts` uses `/api/proxy` endpoints.
  - `frontend/src/app/api/proxy/[...path]/route.ts` proxies requests to the backend.
  - `frontend/src/hooks/useRealtimeStatus.ts` uses SSE + polling.
- Testing:
  - Unit tests via Vitest in `frontend/vitest.config.ts`.
  - Existing tests in `frontend/src/lib/chat-markdown.test.ts` and `frontend/src/lib/tool-parsing.test.ts`.
  - No Playwright configuration or scripts; `frontend/package.json` has no Playwright dev dependency.
- Repo references `references/research-playbook.md` and `references/workpack-templates.md`, but these files are not present in this repo.

## Target State (What Changes)
- Playwright E2E test suite covering core flows (navigation, dashboard status, chat send/receive, recipes CRUD, logs browsing, usage/configs/discover views) with deterministic API mocks.
- Standardized design tokens and UI primitives (buttons, inputs, cards, badges, tables, section headers) reused across pages.
- Minimal inline hex color usage, replaced by CSS variables/tokens and shared classes.
- Large pages split into smaller, named components under `frontend/src/app/<route>/components` or `frontend/src/components`.
- Consistent data-testid attributes for stable E2E selectors.

## Integration Plan
1. Add Playwright dependencies, config, and npm scripts; establish base URL and dev server wiring for E2E runs.
2. Implement deterministic API mocking for E2E (route intercepts + JSON fixtures) covering `/api/proxy/*` and relevant `/api/*` endpoints.
3. Write Playwright specs for the dashboard + global navigation, then chat, then remaining pages.
4. Define shared design tokens in `globals.css` (or a dedicated tokens file) and create reusable UI primitives under `frontend/src/components/ui`.
5. Refactor layout/navigation to use new primitives and tokens.
6. Modularize each major page, replacing repeated UI patterns with shared components and removing inline hex styling.
7. Update chat components and utilities to align with the same style primitives and test selectors.

## Feature Flagging Plan
No new feature flags requested; refactors should preserve existing behavior without gating.

## Testing Plan
- Unit: new utilities (class helpers, formatters, token helpers) covered with Vitest.
- Integration: component-level tests using Testing Library for new UI primitives and extracted page modules.
- E2E: Playwright specs for primary routes and key interactions; use mocked responses to avoid backend dependence.
- Coverage: 100% for new/changed modules introduced in this workpack; do not retrofit coverage for untouched legacy files.

## Non-goals
- Backend/controller changes or API behavior changes.
- Visual redesign or new product features beyond cleanup/standardization.
- Performance optimization unrelated to refactor cleanup.

## Risks & Mitigations
- Risk: UI regressions due to large refactors.
  - Mitigation: incremental component extraction, shared primitives, and E2E coverage before refactoring.
- Risk: E2E flakiness from live backend dependence.
  - Mitigation: deterministic Playwright route mocks and stable selectors.
- Risk: Token changes breaking theme toggle behavior.
  - Mitigation: align theme toggle with new token definitions and update tests accordingly.

## Assumptions
- `origin/main` is the base ref; planning assumes a clean worktree from that branch.
- Playwright will be added as a dev dependency and configured within `frontend/`.
- E2E tests will use mocked API responses rather than requiring a running backend.
- Missing `references/*` templates are noted; workpack content follows the scaffolded format instead.
