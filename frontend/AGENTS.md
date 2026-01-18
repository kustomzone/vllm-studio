# AGENTS.md

Frontend module map and flow notes for vLLM Studio.

## Structure

- `src/app` - Next.js App Router pages and API routes
- `src/components` - shared UI components
- `src/hooks` - client hooks (SSE, context management)
- `src/lib` - API clients, parsing services, utilities
- `src/store` - Zustand state slices
- `tests` - frontend tests

## Key entry points

- `src/app/layout.tsx` - root layout, global fonts, sidebar shell
- `src/app/page.tsx` - landing view
- `src/app/chat/page.tsx` - chat shell and orchestration
- `src/app/api/*` - Next.js API routes that proxy to controller/LiteLLM
- `src/hooks/useSSE.ts` - SSE connection and reconnection
- `src/lib/services/message-parsing` - stream parsing (text/tool_calls/thinking)
- `src/lib/services/context-management` - context and token handling
- `src/store/chat-slice.ts` - chat state and message updates

## Chat flow (frontend)

1. User input builds OpenAI messages and tool list.
2. `POST /api/chat` streams from LiteLLM via SSE.
3. `parseSSEEvents()` routes text/tool_calls/thinking.
4. Tool calls execute via MCP and are appended to the message.
5. Messages persist to `/chats/{id}/messages` and hydrate the store.

## Conventions

- Use `@/` for `src` imports.
- Use AI SDK v5 (`ai` and `@ai-sdk/*`); avoid legacy v4 APIs.
- Keep API calls in `src/lib/api.ts` and related helpers.
- Prefer existing parsing/services in `src/lib/services/*` over ad-hoc parsing.
- State lives in `src/store` slices; avoid local duplication when global state exists.

## Scripts

- `npm run lint`
- `npm test`
- `npm run test:integration`
