Observations: `frontend/src/app/usage/page.tsx` is already modularized into `_components/*` with `PageState` handling; chat currently uses custom streaming in `frontend/src/app/chat/hooks/useChatStream.ts` and `frontend/src/app/api/chat/route.ts`, while `frontend/src/app/api/chat/v2/route.ts` already uses AI SDK v5 `streamText` but isn’t wired into the UI.

Open questions (please answer so I can finalize):
- What “wrap up” remains on the usage page (visual tweaks, data correctness, missing metrics, or cleanup of leftover code)?
- For AI SDK v5 migration, do you want tool execution to move server-side (preferred for full AI SDK flow) or stay client-side (preserve MCP execution in the browser)?

Plan (Option A: Server-side tools, full AI SDK v5 flow):
1) Replace `frontend/src/app/api/chat/route.ts` with AI SDK v5 `streamText` using `@ai-sdk/openai-compatible`, and implement MCP tools on the server by fetching tool definitions from `/mcp/tools` and executing via `/mcp/tools/{server}/{tool}`. Keep systemPrompt injection and preserve model selection.
2) Replace `useChatStream` usage in `frontend/src/app/chat/page.tsx` with `useChat` from `@ai-sdk/react`; map `UIMessage` to existing store `Message` shape (including tool calls/results and `<think>` parsing) and keep the UI unchanged.
3) Update persistence: on user message append and assistant finish, persist messages to `/chats/{id}/messages`, update session title via `/api/title`, and keep `sessionUsage` refresh/bump updated_at.
4) Remove unused custom streaming utilities (`parseSSEEvents`, `useChatStream`, and helpers) once migrated; keep message parsing utilities needed by the UI.
5) Usage page wrap-up: apply any requested remaining fixes (e.g., data alignment, empty-state visuals, type mismatches, or minor UI cleanup) inside `frontend/src/app/usage/page.tsx` and `_components/*`.
6) Verification: run `npm run lint`, `npm run test`, and `npx tsc --noEmit` (if no typecheck script exists); run `npm run test:integration` only if you confirm it’s required for this task.

Plan (Option B: Client-side tools, minimal server changes):
1) Swap `useChatStream` for `useChat` and use `onToolCall` (AI SDK v5 client hook) to execute MCP tools via existing `/mcp/tools` calls.
2) Keep `/api/chat/route.ts` as an AI SDK v5 `streamText` route, but pass tools as model-only schemas (no server execution) so tool calls are emitted to the client.
3) Maintain current persistence, session handling, and side-panel UI by mapping `useChat` messages into the store.
4) Remove custom SSE parsing utilities that are no longer needed.
5) Apply usage page wrap-up fixes as requested.
6) Run verification steps as in Option A.

If you want, I can proceed with Option A by default unless you choose Option B.