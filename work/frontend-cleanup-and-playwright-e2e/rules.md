# Rules: Frontend cleanup and Playwright E2E

## Non-negotiables
1. Do not ask questions; document assumptions in `scope.md` if needed.
2. Keep refactors minimal, isolated, and behavior-preserving.
3. Add unit + integration + E2E tests for new/changed modules.
4. Maintain 100% coverage for newly introduced modules in scope.

## Branching & Hygiene
- Start from a clean working tree and a fresh branch off `origin/main`.
- Avoid drive-by refactors outside the frontend cleanup scope.
- Keep commits small and grouped by task boundaries.

## Engineering Practices
- Centralize styling in design tokens and UI primitives; avoid inline hex values.
- Extract large page sections into named components with clear props.
- Prefer deterministic data-testid selectors for E2E stability.
- Keep API contracts unchanged; treat `frontend/src/lib/api.ts` and `/api/proxy` as integration boundaries.

## Testing & Coverage
- Unit: helper utilities, formatting functions, class helpers.
- Integration: UI primitives and extracted route components (Testing Library).
- E2E: Playwright specs for dashboard, chat, recipes, logs, usage, configs, discover.
- Coverage: enforce on new modules; do not retrofit entire repo coverage.

## Feature Flags
- Not required; preserve existing functionality without new gating.

## Security & Privacy
- Do not log secrets or API keys; avoid exposing real backend URLs in tests.
- Keep E2E fixtures sanitized and deterministic.

## Definition of Done
- `npm run lint`, `npm run test`, and `npx playwright test` pass in `frontend/`.
- UI behavior unchanged while styles are standardized.
- New primitives and modules are fully covered by tests.
