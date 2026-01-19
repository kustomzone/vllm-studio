# vLLM Studio Controller Audit + Rewrite Plan (Bun/TS, platform-agnostic)

This document is based on reading the full Python controller implementation in `controller/` plus the LiteLLM configuration in `config/` and the frontend transport layer in `frontend/src/app/api/*`.

---

## 1) What the controller currently does (functionality map)

### A. HTTP API surface (controller = one base URL)

**System / topology** (`controller/routes/system.py`)
- `GET /health` → Controller version + whether inference `/health` returns 200.
- `GET /status` → `{ running, process, inference_port, launching }`.
- `GET /gpus` → NVIDIA GPU info via NVML (or empty list if unavailable).
- `GET /config` → “service topology” (controller, inference, LiteLLM, postgres, redis, prometheus, grafana, frontend) and env URLs.

**Recipes / model registry** (`controller/routes/lifecycle.py`)
- `GET /recipes` → list recipes, with derived status: `running|starting|stopped`.
- CRUD: `GET/POST/PUT/DELETE /recipes/...`

**Model lifecycle / process orchestration** (`controller/routes/lifecycle.py`, `controller/process.py`)
- `POST /launch/{recipe_id}` → preemptive launch state machine with progress events.
- `POST /evict` → stop running inference.
- `GET /wait-ready` → poll inference `/health`.

**OpenAI compatibility** (`controller/routes/models.py`, `controller/routes/proxy.py`, `controller/app.py`)
- `GET /v1/models` + `GET /v1/models/{model_id}` → recipe-derived model list with `active` flag.
- `POST /v1/chat/completions` → proxy to LiteLLM with *auto-switching*.
- Tokenization helpers (proxy to inference server):
  - `POST /v1/tokenize`
  - `POST /v1/detokenize`
  - `POST /v1/count-tokens`
  - `POST /v1/tokenize-chat-completions` (best-effort estimation)

**Model discovery (local disk)** (`controller/routes/models.py`, `controller/browser.py`)
- `GET /v1/studio/models` → scan `models_dir` + recipe parents for model folders.

**Remote model discovery** (`controller/routes/models.py`)
- `GET /v1/huggingface/models` → proxy HuggingFace Hub API (CORS bypass).

**Chat persistence** (`controller/routes/chats.py`, `controller/store.py`)
- Sessions: `GET/POST/PUT/DELETE /chats`
- Messages: `POST /chats/{id}/messages`
- Token totals: `GET /chats/{id}/usage`
- Fork: `POST /chats/{id}/fork`

**Logs + events** (`controller/routes/logs.py`, `controller/events.py`)
- `GET /logs` → list `/tmp/vllm_*.log` files.
- `GET/DELETE /logs/{session_id}`
- `GET /logs/{session_id}/stream` → per-log SSE stream.
- `GET /events` → global SSE stream (`status`, `gpu`, `metrics`, `launch_progress`, `log`).
- `GET /events/stats` → subscriber stats.

**Monitoring / benchmark** (`controller/routes/monitoring.py`, `controller/metrics.py`, `controller/store.py`)
- `GET /metrics` → Prometheus metrics for controller + GPU.
- `GET /peak-metrics` → stored “best observed” TPS + TTFT.
- `GET /lifetime-metrics` → cumulative tokens, energy, uptime.
- `POST /benchmark` → sends one OpenAI request and infers prefill/generation TPS.

**MCP (tools)** (`controller/routes/mcp.py`, `controller/store.py`)
- CRUD of MCP servers in SQLite.
- Tool discovery: `GET /mcp/tools`, `GET /mcp/servers/{id}/tools`
- Tool execution: `POST /mcp/tools/{server}/{tool}` (plus alias)

**Usage analytics (LiteLLM spend logs)** (`controller/routes/usage.py`)
- `GET /usage` → heavy SQL against Postgres `LiteLLM_SpendLogs` for dashboards.

### B. Background tasks / runtime behaviors

**Metrics loop** (`controller/app.py`)
Every 5 seconds:
- Scan running inference process (`psutil` scan).
- GPU probe (`pynvml`).
- Scrape vLLM Prometheus metrics via `GET :8000/metrics` and calculate per-second token rates.
- Update Prometheus gauges/counters.
- Update lifetime energy+uptime in SQLite.
- Publish SSE updates (`status`, `gpu`, `metrics`).

**Launch state machine + preemption** (`controller/routes/lifecycle.py`)
- Single lock `_switch_lock`.
- If launch A in-progress and launch B requested: publish “preempting”, cancel A, `evict(force)`, then proceed with B.

### C. External dependencies / integration points
- **vLLM**: launched via `vllm serve` / python module; health via `/health`; tokenization via `/tokenize`.
- **SGLang**: launched via `python -m sglang.launch_server`.
- **TabbyAPI** (ExLlamaV3-ish): detected via process scan heuristics; partial model info from `/v1/models`.
- **LiteLLM**: data-plane OpenAI proxy at `:4100`, plus custom callback `config/tool_call_handler.py`.
- **Postgres**: LiteLLM spend logs.
- **Redis**: LiteLLM caching.
- **Prometheus/Grafana**: optional monitoring stack.
- **MCP servers**: run via `npx` or custom binaries over stdio JSON-RPC.

---

## 2) The biggest architectural “tangles” today

1. **Controller mixes control-plane and data-plane logic.**
   - It does model/process lifecycle *and* OpenAI proxying *and* response mutation.

2. **Tool-call + reasoning parsing exists in multiple places.**
   - LiteLLM callback (`config/tool_call_handler.py`) does conversions/parsing.
   - Controller proxy (`controller/routes/proxy.py`) also mutates streaming output.
   - This creates drift and hard-to-debug edge cases.

3. **Platform coupling:**
   - `/tmp` log paths, NVML dependency, and searching `~/.nvm/...` for exa-mcp-server are not portable.

4. **Process discovery is primarily `psutil`-scan based.**
   - Works locally but is not “system-agnostic” and complicates multi-instance / remote endpoints.

5. **OpenAI compatibility is partial and custom.**
   - `/v1/models` is recipe-derived (fine), but `/v1/chat/completions` is really “LiteLLM + controller transforms + auto-switch”.

---

## 3) How to modularize the controller (clean boundaries)

### Recommended boundaries (language-agnostic)

**A. Core types + schemas (shared)**
- `Recipe` / `LaunchSpec` / `RuntimeInfo` / `GPUInfo` / `Event` / `MCPServer`.
- Validate with Zod (TS) or Pydantic (Python). In a TS rewrite: prefer Zod for runtime validation.

**B. Storage**
- A `Store` interface with backends:
  - SQLite (local dev, single node)
  - optional Postgres (multi-node)

**C. Inference runtime adapters (plug-ins)**
Define an interface like:
- `detectRunning()`
- `start(launchSpec)`
- `stop(runtimeInfo)`
- `health(baseUrl)`
- `getLogs(runtimeInfo)`
- `getVersion(runtimeInfo)`
- `getMetrics(runtimeInfo)` (optional)

Adapters:
- `vllm`
- `sglang`
- `tabbyapi` / `exllamav3`
- `mlx` (local mac)

**D. Control-plane services**
- `ModelManager` (launch/preempt/state machine)
- `MetricsCollector` (poll probes + emit events)
- `MCPManager` (tool list/call)

**E. API layer**
Thin route handlers; zero business logic.

---

## 4) Maximizing vLLM + LiteLLM (remove custom code where possible)

### A. Prefer vLLM parsers over “regex parsing”
- Use vLLM `--tool-call-parser` and `--reasoning-parser` wherever the model supports it.
- Keep the recipe defaults/heuristics, but push all parsing into vLLM when possible.

### B. Consolidate all remaining tool-call normalization into *one* place
Best option if LiteLLM stays:
- Make `config/tool_call_handler.py` the single “normalization layer” for:
  - MCP-style tool calls → OpenAI tool_calls
  - `<think>` → `reasoning_content`
- Keep the controller proxy as a dumb streaming forwarder (no mutation).

If LiteLLM is removed later:
- Implement a single “stream transformer pipeline” in the Bun gateway.

### C. Reduce controller surface area by delegating to LiteLLM
- Proxy **all** `/v1/*` except where you intentionally override (e.g., `/v1/models` to show recipes).
- Avoid duplicating title generation in both frontend and controller; pick one.
- Usage analytics can live in Grafana + LiteLLM UI; keep `/usage` as an optional plugin.

---

## 5) Backend standardization: one wrapper around OpenAI providers + custom features

### The simplest standard model
Treat everything as:
- **Data plane:** OpenAI-compatible “LLM Gateway” (LiteLLM *or* a TS provider layer)
- **Control plane:** “Runtime Manager” that starts/stops local engines

Expose a single “Backend API” that:
1) forwards `/v1/*` to the gateway (OpenAI standard)
2) exposes your custom control-plane endpoints:
   - `/recipes`, `/launch`, `/evict`, `/status`, `/events`, `/logs`, `/mcp/*`, `/gpus`

This matches how the frontend uses `createOpenAICompatible({ baseURL: BACKEND_URL + '/v1' })`.

### v1 “Universal Proxy” + per-endpoint upstream routing (required)
The controller should behave as the canonical OpenAI v1 endpoint, but with configurable upstreams per capability.

Concretely:
- Implement a catch-all proxy for `/v1/{path...}` that forwards to an upstream base URL.
- Allow overrides by endpoint family (audio/images/embeddings/etc) so you can point:
  - `/v1/audio/*` to any transcription/speech service (any host/port)
  - `/v1/images/*` to any image backend (any host/port)
  - `/v1/embeddings` to any embeddings backend (any host/port)
- Keep chat special: for `/v1/chat/completions` (and ideally `/v1/responses`) the controller may preflight “ensure local model running” when `model` matches a local recipe; then proxy to the configured upstream.
- Prefer true pass-through streaming and multipart bodies (avoid controller-side parsing).

Suggested config shape (env vars or a config file):
- `VLLM_STUDIO_V1_DEFAULT_BASE_URL` (fallback)
- `VLLM_STUDIO_V1_CHAT_BASE_URL`
- `VLLM_STUDIO_V1_EMBEDDINGS_BASE_URL`
- `VLLM_STUDIO_V1_IMAGES_BASE_URL`
- `VLLM_STUDIO_V1_AUDIO_BASE_URL` (or split `..._TRANSCRIPTIONS_...`, `..._SPEECH_...`)
- `VLLM_STUDIO_V1_MODERATIONS_BASE_URL`

Auth behavior:
- If the client sends `Authorization`, forward it unchanged.
- Otherwise allow per-upstream static keys so the controller can act as a single authenticated gateway.

---

## 6) Data/state machine map (what we store vs what we derive)

### Persistent state (stored)
**`data/controller.db`**
- `recipes` (launch configs)
- `mcp_servers` (tool servers)
- `peak_metrics` (best perf per model)
- `lifetime_metrics` (energy/tokens/uptime)

**`data/chats.db`**
- `chat_sessions`
- `chat_messages` (including optional tool_calls JSON)

**Logs**
- `/tmp/vllm_<recipe_id>.log` (launch logs)

**External**
- Postgres `LiteLLM_SpendLogs`
- Redis (LiteLLM cache)

### Derived/extracted state (computed at runtime)
- Running model info: by scanning processes and/or health endpoints.
- GPU metrics: via NVML.
- vLLM metrics: parse `/metrics` text.
- “recipe status”: compare running model vs recipe.
- Throughput rates: diff counters over time.
- Service health: TCP connect checks + HTTP `/health`.

### Ephemeral runtime state (in-memory)
- Launch locks and cancellation events.
- SSE subscriber queues.
- Rolling cache of last vLLM metrics.

### Core state machines
- **Launch/preempt**: idle → (preempt?) → evict → launch → wait-ready → ready/error/cancel.
- **Proxy auto-switch**: request(model=X) → ensure running(X) → forward to gateway.
- **Metrics loop**: poll → update stores → publish events.

---

## 7) Making the controller “system agnostic”

### A. Stop relying on process scanning as the primary source of truth
Preferred pattern:
- When *you* launch a runtime, persist:
  - `pid` (if local)
  - `baseUrl`
  - `backendKind`
  - `logPath`
  - `startedAt`
- Use probes (`/health`, `/v1/models`, `/metrics`) to validate.

Process scanning becomes an optional *discovery* feature, not the backbone.

### B. Replace hard-coded ports and paths
- Logs: use `dataDir/logs/` or `os.tmpdir()`.
- Ports: treat `inference_port`, `litellm_port` as config with overrides.

### C. Backend capability model
Expose a capability descriptor per runtime:
- `openaiCompatible: boolean`
- `supportsTokenize: boolean`
- `supportsMetrics: boolean`
- `supportsToolCalling: boolean`
- `supportsReasoningContent: boolean`

UI can adapt without special casing backend names.

---

## 8) Standardizing around TypeScript + AI SDK UI (recommended)

You already use AI SDK v5 in `frontend/src/app/api/chat/route.ts` with `createOpenAICompatible`.

For a TS/Bun rewrite, the cleanest alignment is:

### Option A (minimal change): keep OpenAI compatibility as the contract
- Backend continues to expose `/v1/chat/completions`.
- Frontend continues using AI SDK server routes (`/api/chat`) as the adapter.

Pros: least migration.
Cons: you keep a “BFF” layer in Next.js.

### Option B (cleaner long-term): backend implements the AI SDK stream protocol directly
- Backend exposes `POST /api/chat` that returns AI SDK’s Data Stream Protocol / UI Message stream.
- Frontend `useChat({ api: BACKEND_URL + '/api/chat' })` can call backend directly.

Pros: removes duplication (no Next.js API proxy required).
Cons: you must implement the AI SDK stream protocol on the backend.

### Shared types package
Create a shared TS package (monorepo) used by frontend + backend:
- `Recipe`, `RuntimeInfo`, `MCPServer`, `EventPayload`, `UsageSummary`.
- Use Zod schemas, export inferred TS types.

---

## 9) “What versions are running?” (vLLM/SGLang/ExLlamaV3/MLX)

Add a single endpoint like `GET /system/runtimes` returning:
- detected runtime(s): `{ kind, status, baseUrl, model, pid?, version?, build?, gpu?, features }`

Version detection strategy per backend:
- **Prefer HTTP introspection** if supported (future-proof): `/version`, `/info`, etc.
- Otherwise **command introspection**:
  - `vllm --version` or `python -c 'import vllm; print(vllm.__version__)'`
  - `python -c 'import sglang; print(getattr(sglang, "__version__", "unknown"))'`
  - `python -c 'import tabbyAPI; ...'` and/or `pip show tabbyapi`
  - `python -c 'import mlx; print(mlx.__version__)'`
- If neither works, return `version: null` but still report `running: true`.

---

## 10) Minimal rewrite scope (what to keep vs make optional)

### Keep (core)
- Recipes CRUD
- Launch/evict state machine + progress events
- OpenAI gateway proxy (`/v1/chat/completions`, `/v1/*` passthrough)
- Model list for UI (`/v1/models` derived from registry)
- MCP server CRUD + tool list/call
- Logs (list/tail/stream)
- Status + runtime discovery + version surfacing

### Optional modules (plugins)
- Chat persistence (`/chats/*`) if you want server-side history
- Usage analytics (`/usage`) → better handled by Grafana/LiteLLM UI
- HuggingFace proxy (`/v1/huggingface/models`)
- Benchmarking (`/benchmark`)
- Tokenization helpers (nice-to-have)

---

## 11) Suggested Bun/TS file layout (clean + modular)

A minimal but scalable structure:

- `backend/src/index.ts` (server bootstrap)
- `backend/src/config.ts`
- `backend/src/types/*` (Zod schemas)
- `backend/src/storage/*` (sqlite)
- `backend/src/services/model-manager.ts`
- `backend/src/services/metrics-collector.ts`
- `backend/src/services/mcp-manager.ts`
- `backend/src/adapters/inference/vllm.ts`
- `backend/src/adapters/inference/sglang.ts`
- `backend/src/adapters/inference/tabbyapi.ts`
- `backend/src/adapters/inference/mlx.ts`
- `backend/src/adapters/gateway/litellm.ts` (proxy /v1)
- `backend/src/http/routes/*`

If you want frontend-backend shared types:
- `packages/shared/src/*` (Zod schemas)

---

## 12) Next concrete steps

1. Decide whether LiteLLM remains the primary OpenAI gateway.
2. Pick Option A vs Option B for AI SDK UI integration.
3. Define the *stable API contract* for:
   - recipes, runtime status, logs, events, mcp
4. Implement the Bun backend with vLLM + SGLang adapters first.
5. Add TabbyAPI/ExLlamaV3 + MLX adapters as separate plugins.
