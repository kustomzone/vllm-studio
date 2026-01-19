# controller-new (canary)

A Bun-based **canary controller** that keeps the controller as the **canonical OpenAI-compatible `/v1/*` endpoint**.

`controller-new` is intentionally small: it’s a **universal reverse proxy** that can route every OpenAI v1 surface area (chat, embeddings, images, audio, etc.) to **any upstream URL** — local (`localhost`) or remote (LAN IP, public HTTPS).

It is designed to run **in front of** the existing Python controller while we incrementally rewrite functionality.

---

## Design goals

- **Full OpenAI `/v1/*` compatibility**: any OpenAI SDK should work by pointing at `http://<controller-new>/v1`.
- **Everything can be remote**: vLLM/SGLang/LiteLLM/Whisper/image generators can live on the same device or any URL.
- **No controller-side parsing** for non-chat endpoints: stream and multipart pass-through.
- **Incremental migration**: non-`/v1` control-plane routes keep working by forwarding to the existing Python controller.

---

## What it does

- Proxies **all** `/v1/*` endpoints to configurable upstreams (per endpoint family).
  - Example: route `/v1/audio/transcriptions` to a dedicated transcription service.
  - Example: route `/v1/images/*` to a dedicated image service.
- Proxies **all non-`/v1`** endpoints (recipes, launch, SSE, logs, MCP, etc.) to the existing Python controller.
- Adds `X-VLLM-Studio-Canary: controller-new` to responses.

---

## Routing rules

`controller-new` selects an upstream purely by **path prefix**:

| Incoming path | Upstream |
|---|---|
| `/v1/chat/*` (incl. `/v1/chat/completions`) | `VLLM_STUDIO_V1_CHAT_BASE_URL` |
| `/v1/responses*` | `VLLM_STUDIO_V1_RESPONSES_BASE_URL` |
| `/v1/embeddings*` | `VLLM_STUDIO_V1_EMBEDDINGS_BASE_URL` |
| `/v1/images*` | `VLLM_STUDIO_V1_IMAGES_BASE_URL` |
| `/v1/audio*` | `VLLM_STUDIO_V1_AUDIO_BASE_URL` |
| any other `/v1/*` | `VLLM_STUDIO_V1_DEFAULT_BASE_URL` |
| any non-`/v1` path | `VLLM_STUDIO_CONTROL_PLANE_BASE_URL` |

**Important:** each upstream can be **any** URL (local or remote), including a **path prefix**.

If an upstream base URL ends with `/v1`, `controller-new` avoids generating double `/v1/v1/...` when forwarding.

---

## Auth forwarding / injection

- If the incoming request includes `Authorization`, it is forwarded unchanged.
- If the incoming request does **not** include `Authorization`, `controller-new` can inject a static upstream key (per family).

This lets you expose a single “public” controller endpoint while keeping upstream credentials private.

---

## Streaming + multipart support

- **Streaming:** upstream response bodies are streamed back to clients (no buffering).
- **Uploads:** request bodies are streamed upstream. This is important for `multipart/form-data` requests like `/v1/audio/transcriptions`.

---

## Run

```bash
cd controller-new
bun run dev
```

---

## Configuration

See `.env.example`.

### Ports

- `PORT` (default: `8081`)

### Control-plane base (existing Python controller)

- `VLLM_STUDIO_CONTROL_PLANE_BASE_URL` (default: `http://localhost:8080`)

This can also be a remote URL (e.g. another machine running the Python controller).

### v1 upstream routing

- `VLLM_STUDIO_V1_DEFAULT_BASE_URL` (default: `VLLM_STUDIO_CONTROL_PLANE_BASE_URL`)
- `VLLM_STUDIO_V1_CHAT_BASE_URL`
- `VLLM_STUDIO_V1_RESPONSES_BASE_URL`
- `VLLM_STUDIO_V1_EMBEDDINGS_BASE_URL`
- `VLLM_STUDIO_V1_IMAGES_BASE_URL`
- `VLLM_STUDIO_V1_AUDIO_BASE_URL`

### Optional upstream API keys

Used only when the incoming request does not include `Authorization`:

- `VLLM_STUDIO_V1_DEFAULT_API_KEY`
- `VLLM_STUDIO_V1_CHAT_API_KEY`
- `VLLM_STUDIO_V1_RESPONSES_API_KEY`
- `VLLM_STUDIO_V1_EMBEDDINGS_API_KEY`
- `VLLM_STUDIO_V1_IMAGES_API_KEY`
- `VLLM_STUDIO_V1_AUDIO_API_KEY`

---

## Example: split everything across machines

```bash
PORT=8081

# Existing python controller (recipes/launch/logs/SSE)
VLLM_STUDIO_CONTROL_PLANE_BASE_URL=http://192.168.1.10:8080

# Default OpenAI v1 upstream
VLLM_STUDIO_V1_DEFAULT_BASE_URL=http://192.168.1.20:4100

# Chat straight to a remote vLLM OpenAI server
VLLM_STUDIO_V1_CHAT_BASE_URL=http://192.168.1.30:8000/v1

# Audio to a dedicated transcription service
VLLM_STUDIO_V1_AUDIO_BASE_URL=http://192.168.1.40:5300/v1

# Images/embeddings elsewhere
VLLM_STUDIO_V1_IMAGES_BASE_URL=https://images.my-domain.com/v1
VLLM_STUDIO_V1_EMBEDDINGS_BASE_URL=http://192.168.1.50:5500/v1
```

---

## Debug

- `GET /__config` returns the resolved routing table (no secrets).

---

## Known limitations (current canary)

- `controller-new` currently does **not** implement model auto-switching / launching itself.
  - If you point `VLLM_STUDIO_V1_CHAT_BASE_URL` at the existing Python controller, you still get the current auto-switch behavior.
  - If you point chat at a remote vLLM/LiteLLM directly, it will behave like a standard proxy (no launch control).

This is intentional: the canary is a safe first step to prove v1 routing + remote upstream support.
