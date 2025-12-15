# Operations Runbook (lmvllm)

## Services and Ports
- Controller API: `vllmstudio` FastAPI on `:8080` (configurable via `VLLMSTUDIO_API_PORT`)
- Backend inference: vLLM/SGLang on `:8000`
- Proxies: FastAPI adapters on `:8001`/`:8002`/`:8003` (per model family)
- UI: OpenWebUI-derived frontend on `:3000`

## Launch Commands
- Controller (dev auto-reload): `python -m vllmstudio.cli --reload`
- Controller (prod): `./start.sh` (honors `VLLMSTUDIO_API_PORT`, `VLLMSTUDIO_VLLM_PORT`, `VLLMSTUDIO_PROXY_PORT`, `VLLMSTUDIO_MODELS_DIR`, `VLLMSTUDIO_RECIPES_DIR`)
- Proxies: `python -m proxy.main` (configure via `proxy/config.py` or env)
- Frontend: `cd openwebui-src && npm install && npm run dev -- --port 3000`

## Config Highlights
- `vllmstudio/config.py` now defaults `recipes_dir` to `<repo>/recipes`; override with `VLLMSTUDIO_RECIPES_DIR`.
- Metrics parsing lives in `vllmstudio/metrics.py`; recipe generation logic in `vllmstudio/recipe_generator.py`.
- Auth: set `VLLMSTUDIO_API_KEY` for controller; proxies use `AUTH_API_KEY` in `proxy/config.py`.

## Health/Smoke Checks
- Controller health: `curl http://localhost:8080/health`
- Backend reachability: `curl http://localhost:8000/health`
- Proxy health: `curl http://localhost:8001/health`
- Metrics scrape: `curl http://localhost:8080/metrics`

## Tests
- Unit suite scoped to repo tests: `pytest`
- New coverage: recipe generation heuristics, metrics parser throughput, recipe manager persistence/status.

## Logs
- Controller logs default to `/tmp/vllmstudio.log`; per-model launch logs `/tmp/vllm_{recipe_id}.log`
- Proxy logs: stdout/stderr (use systemd or docker for persistence)

## Notes
- A safety branch `backup/pre-rearch-20251215` captures the pre-change state.
- See `docs/rearchitecture-plan.md` for the phased refactor roadmap and goals.
