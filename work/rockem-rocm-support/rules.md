<!-- CRITICAL -->
# Rules: First-class ROCm (Rock-Em) support

## Non-negotiables
1. Do not ask questions. If blocked, make the best decision and document assumptions.
2. Keep changes minimal, isolated, and reversible.
3. Add realistic unit + integration + E2E tests for the behavior implemented.
4. Enforce strict coverage for new/changed modules within scope.
5. Follow repo conventions in `AGENTS.md`:
   - files >60 LOC require a `// CRITICAL`, `# CRITICAL`, or `<!-- CRITICAL -->` marker
   - kebab-case filenames/dirs
   - run the app checks before claiming completion

## Branching & Hygiene
- Start from a clean working tree.
- Branch from the requested base ref and pull latest.
- Make small commits and avoid drive-by refactors.

## Engineering Practices
- Prefer clear interfaces and small modules.
- Avoid hidden coupling between unrelated subsystems.
- Document integration points and invariants in code and/or tests.

## Testing & Coverage
- Unit: pure logic and feature flags.
- Integration: component/service boundaries with realistic mocks.
- E2E: real routes/UI flows where applicable.
- Coverage: 100% for new/changed modules in scope (do not attempt to retrofit whole-repo coverage unless requested).

## Feature Flags (If Needed)
- Default-off.
- Gate access in two layers:
  - route-level (hard block)
  - UI-level (no clickable entry points)
- Keep implementation tiny: a single `features` helper and env-driven toggles.

## Definition of Done
- Controller passes: `cd controller && bun run typecheck && bun test`.
- Frontend passes: `cd frontend && npm run build && npm run lint` (and Playwright for new E2E).
- Required flows work on both CUDA and ROCm hosts (or via deterministic mocks when CI hardware is unavailable).
- Disabled features remain present but inaccessible until flags enable them.
