# Chat (Tools, Previews, Forking, Token Usage)

The Chat UI lives at `http://localhost:3000/chat` and talks to the controller API at `http://localhost:8080`.

## Tools (MCP + function calling)

- Toggle **Tools** to allow the model to call tools.
- Tool calls are rendered as cards under the assistant message.
- This repo supports both:
  - structured `tool_calls` (OpenAI-style), and
  - GLM-style inline `<tool_call>...</tool_call>` blocks (best-effort parsing).

### Common GLM gotcha: concatenated JSON

Some models output tool arguments like:

```
{"query":"warsaw"}{"query":"warsaw"}
```

We repair this by extracting the last valid JSON object/array and using it as the arguments payload.

## Previews (Artifacts)

- Toggle **Preview** to render runnable previews for code blocks:
  - ` ```html `, ` ```javascript `, ` ```jsx ` / ` ```tsx `, ` ```svg `
- Mermaid diagrams render from ` ```mermaid ` blocks.

### Rendering rules (what works best)

- Put preview code in the normal assistant response (not inside `<think>`/`<thinking>`).
- Always fence preview code blocks, e.g. ` ```svg ... ``` `.
- Mermaid must start with a diagram header like `graph TD`, `sequenceDiagram`, etc.

If a diagram is invalid, the UI shows an inline error + the original code without breaking the page.

## Forking + multi-model splits

- Click the branch icon on any message to fork a new chat starting from that point.
- In **Chat Settings**, you can fork/split a chat into multiple sessions with different models.

## Token usage + cost tracking

- The UI tracks tokens per assistant request:
  - input tokens are estimated via `POST /v1/chat/completions/tokenize`
  - completion tokens are counted via `POST /v1/tokens/count` (text mode)
- Session totals are exposed via `GET /chats/{id}/usage` and shown in the chat header.

### Optional cost estimates

If you set `VLLMSTUDIO_TOKEN_PRICING_JSON`, the backend can attach `estimated_cost_usd` to messages and sessions.

Example:

```bash
export VLLMSTUDIO_TOKEN_PRICING_JSON='{"default":{"prompt_per_1k":0.0005,"completion_per_1k":0.0015}}'
```

