# lmvllm Re-architecture Plan

## Context (current)
- Frontend: OpenWebUI fork served on `3000`, hitting Studio API under `/vllm-studio`. Mobile layout currently broken (horizontal scroll, dense tables).
- Controller/API: `vllmstudio` FastAPI app on `8080` orchestrates recipes, process management, metrics, and `/v1/*` passthrough to backend on `8000`.
- Proxies: FastAPI proxy layer on `8001/8002/8003` translating model-specific formats (MiniMax, GLM, Mistral, etc.) with formatter/parser glue.
- Backend inference: vLLM/SGLang running on `8000`; Studio launches/evicts via recipes.
- Recipes: JSON files in `recipes/` with varying fields; generator and metrics helpers live in the API + OpenWebUI backend glue.
- Deployment bits: `start.sh`, `install-services.sh`, `docker-compose` for OpenWebUI only; no unified supervisor across components. Logging/metrics aggregation lives in the Studio API and frontend JS.

## Goals
1) Modular, self-contained services:
   - **Controller API**: recipe CRUD, model lifecycle (switch/evict/launch), metrics, `/v1/*` passthrough with auto-switching. Shippable as its own Python package with CLI + systemd/docker targets.
   - **Proxy factory**: pluggable translators (Anthropic/OpenAI/Minimax/GLM/Mistral/etc.), per-proxy venv support, registry for community contributions, and health/metrics.
   - **UI**: clean, mobile-first dashboard (metrics, GPU info, recipe picker, logs, chat), independent build/deploy target.
   - **CLI/docs**: single-skill/tool surface for models + human operators; clear runbook.
2) Reliability: always-on processes with supervision, crash containment, healthchecks, and graceful backoff on errors.
3) Observability: GPU + perf metrics surfaced consistently (prefill/gen TPS, TTFT, token counts, failures), log streaming that works on desktop/mobile.
4) Correctness: recipe generator math fixed, IDs and venv/env handling deterministic, proxy selection robust.

## Proposed Work Breakdown
### Phase 1: Hard baseline + interfaces
- Normalize config schema across controller/proxy/UI (ports, recipes dir, models dir, auth, venv roots).
- Document current behaviors and gaps (recipes, generator, metrics, proxy routing).
- Add lightweight architecture doc + runbook; keep current services up (no take-down).

### Phase 2: Service modularization
- Carve controller into `packages/controller` (or keep `vllmstudio/` but expose as package) with clear service interface boundaries for: recipe store, process supervisor, metrics collector, proxy passthrough.
- Extract proxy into `packages/proxy-factory` with registry of adapters (minimax, glm, mistral) and per-adapter venv shim; add health + version endpoints.
- Shared config + typed settings module to avoid drift (`VLLMSTUDIO_*` envs unified).
- Add systemd unit templates + compose targets for controller and proxies; make start scripts chain them safely.

### Phase 3: Correctness + resilience
- Fix recipe generator math (parameter counting, TP/PP/DP, ctx length memory math, fp8 guidance); validate IDs and model-path mapping.
- Ensure recipes honor venv/python overrides and env vars; improve ID/served-model-name matching.
- Harden process supervision: retry/backoff on launch, structured logs, explicit failure reasons surfaced to UI; ensure proxy passthrough keeps running on backend errors.
- Metrics/logging: emit structured metrics for TPS/TTFT/prompt/gen tokens and GPU stats; reliable log tailing with pagination.
- Unit tests for recipe manager, process manager, generator math, proxy selection, and metrics parsing.

### Phase 4: UI/UX
- Rework OpenWebUI-derived page (or new lightweight UI module) to be mobile-first: responsive grids/cards, no horizontal scroll, touch-friendly controls.
- Ensure chat page lists recipes and lets users hot-swap models; surface current model + status.
- Dedicated metrics view (GPU perf, TPS, TTFT) and log viewer with filtering/search.
- Style cleanup with consistent tokens; keep license-safe (inspired, not copied).

### Phase 5: Docs + CLI/tooling
- CLI: `lmvllm` command to query status, switch/evict, list recipes/models, tail logs, and hit proxy registry.
- Docs: architecture, config matrix, deploy/runbook (systemd/compose), contribution guide for proxy registry + recipes, troubleshooting.
- Testing matrix and how-to; CI-ready test runner.

## Testing Strategy
- `pytest` unit suite for controller (recipes/process/auto-switch/token counter), proxy adapter selection/formatting, and generator math.
- Snapshot tests for API surfaces (FastAPI TestClient).
- Frontend: vitest/Playwright smoke for layout + recipe picker + metrics cards (follow-up).
- Health/observability: curl-based smoke scripts for `/health`, `/status`, `/v1/models`, proxy health, and log endpoints.

## Immediate Next Steps
- Keep services running; work on a feature branch (`backup/pre-rearch-20251215` captured).
- Normalize settings defaults (recipes_dir/models_dir), add architecture/runbook doc, and start carving controller/proxy into clearer modules with tests.
