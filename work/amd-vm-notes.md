# VM Notes (AMD HotAisle + NVIDIA host split)

## Local UI
- UI: http://127.0.0.1:3006
- Split runner: `bun scripts/rockem/run-ui-3006-split.ts`

## Tunnels
- AMD controller (voice + media): http://127.0.0.1:18080 -> `hotaisle@23.183.40.84:8080`
- NVIDIA controller (LLM): http://127.0.0.1:18081 -> `ser@192.168.1.70:8080`

## Why the backend sometimes “goes down”
- If the UI auto-selects a different model id (e.g. `bu-30b-a3b`) the controller tries to hot-switch recipes.
- For big recipes, that can stall long enough that the UI shows “Working…” and looks broken.

Fixes landed on branch `amd`:
- llama.cpp servers default to `--jinja` (prevents `tools param requires --jinja flag` stream failures).
- UI prefers the currently active model by default to avoid accidental hot-switch to a slow recipe.

## Playwright proof artifacts (port 3006)
All 7 integration tests pass with proof screenshots + videos:
- `frontend/test-results/**/proof-*.png`
- `frontend/test-results/**/video.webm`

## Cost control
When you’re finished, deprovision the HotAisle VM (`enc1-gpuvm019`) to avoid ongoing GPU charges.
