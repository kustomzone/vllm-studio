<!-- CRITICAL -->
# Task 08 — VLM Support In Pi-mono Agent Runtime (Required)

## Objective
Enable **agent mode + tools** for VLM sessions by allowing the `/chats/:id/turn` (Pi-mono) path to include image parts, and ensuring those parts reach the inference backend in a real multimodal format.

## Files Involved
- `controller/src/routes/chats.ts` (`POST /chats/:sessionId/turn`)
- `controller/src/services/agent-runtime/run-manager.ts`
- `controller/src/services/agent-runtime/message-mapper.ts`
- `controller/src/stores/chat-store.ts` (already stores `parts`)
- `frontend/src/app/chat/_components/layout/chat-page.tsx`
- `frontend/src/app/chat/types.ts` (attachment typing)

## Changes
- Extend `/chats/:id/turn` request schema:
  - Accept `parts` (array) as an alternative to `content` string.
  - Keep `content` for backward compatibility; if both exist, prefer `parts`.
- Frontend:
  - When in agent runtime path and images exist:
    - Construct `parts` with `text` and `image` entries.
    - Send `parts` in the turn request.
- Controller:
  - Update `message-mapper.ts` to translate stored image parts into an OpenAI-compatible multimodal message (or the closest equivalent supported by the selected runtime).
  - Ensure tool calling remains compatible (tool calls must still be parsed/normalized).
  - If Pi-mono’s model client cannot represent image parts:
    - extend the model client wrapper in vLLM Studio (preferred), or
    - fall back to the task-07 “direct OpenAI path” for VLM requests while preserving agent-mode via a controller-side “tool loop”.

## Tests
- Controller:
  - Unit test: storing and retrieving a message with image parts from `ChatStore`.
  - Integration test: `/chats/:id/turn` accepts `parts` and persists them.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- Agent runtime supports VLM turns with image parts end-to-end (agent tools still work).
- Stored chat messages persist image parts (no placeholders-only mode for VLM).
