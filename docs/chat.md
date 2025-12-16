# Chat

UI: `http://localhost:3000/chat` • Controller API: `http://localhost:8080`

## Toggles

- **Tools**: enables function calling (MCP tools show as tool-call cards).
- **Preview**: renders runnable code blocks (`html`, `javascript`, `jsx/tsx`, `svg`) and Mermaid (`mermaid`).

## Forking / splitting

- Branch icon on a message forks a new chat from that point.
- **Chat Settings** can split into multiple chats (one per model).

## Common issues

- **GLM concatenated JSON args**: `{"a":1}{"a":1}` → we extract the last valid JSON and use it as tool arguments.
- **Mermaid syntax**: diagrams must start with a header like `graph TD` or `sequenceDiagram`; invalid diagrams show an inline error (won’t break the page).

## Token usage + optional cost

- Input estimate: `POST /v1/chat/completions/tokenize`
- Output count: `POST /v1/tokens/count`
- Session totals: `GET /chats/{id}/usage`

Optional show cost (backend attaches `estimated_cost_usd`):

```bash
export VLLMSTUDIO_TOKEN_PRICING_JSON='{"default":{"prompt_per_1k":0.0005,"completion_per_1k":0.0015}}'
```
