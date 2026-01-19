# Chat v2 (AI SDK v6) Rebuild Scope

## Goal
Build a new chat experience under `chat-v2` that matches the current chat UI and behavior, but is implemented from scratch and AI SDK v6-first.

## Constraints
- The directory must be named `chat-v2`.
- Component names should be simple (e.g., `ChatSidePanel`, `ToolBelt`).
- Do not reuse existing chat components; re-implement minimally while matching style.
- Persist `UIMessage[]` end-to-end.

## References
- https://ai-sdk.dev/docs/ai-sdk-ui/overview
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- https://github.com/vercel/ai/tree/main/examples/next-openai

## Architecture Summary
- Client uses `useChat` from `@ai-sdk/react`.
- UI renders `message.parts` (not `content`).
- Thinking uses `reasoning` parts.
- Tool UI uses typed tool parts (`tool-<name>`) and/or `dynamic-tool`.
- Client tool execution uses `onToolCall` + `addToolOutput` + `sendAutomaticallyWhen`.
- Server uses `convertToModelMessages` + `streamText` + `toUIMessageStreamResponse`.

## New File Tree (chat-v2 only)
- `frontend/src/app/chat-v2/page.tsx`
- `frontend/src/app/chat-v2/ChatPage.tsx`
- `frontend/src/app/chat-v2/ChatMessageList.tsx`
- `frontend/src/app/chat-v2/ChatMessageItem.tsx`
- `frontend/src/app/chat-v2/ChatSidePanel.tsx`
- `frontend/src/app/chat-v2/ToolBelt.tsx`
- `frontend/src/app/chat-v2/ChatSettingsModal.tsx`
- `frontend/src/app/chat-v2/MCPSettingsModal.tsx`
- `frontend/src/app/chat-v2/UsageModal.tsx`
- `frontend/src/app/chat-v2/ExportModal.tsx`
- `frontend/src/app/chat-v2/ChatSplashCanvas.tsx`
- `frontend/src/app/chat-v2/useChatSessions.ts`
- `frontend/src/app/chat-v2/useChatTools.ts`
- `frontend/src/app/chat-v2/useChatUsage.ts`
- `frontend/src/app/chat-v2/useChatTransport.ts`
- `frontend/src/app/chat-v2/useChatDerived.ts`
- `frontend/src/app/chat-v2/types.ts`
- `frontend/src/app/api/chat-v2/route.ts`

## UI Parity Checklist
- Layout and spacing match current chat.
- User vs assistant styling identical.
- Streaming updates in-place.
- Thinking panel shows live reasoning.
- Tool activity timeline with partial input streaming and results.
- Side panel tabs: Tools and Artifacts.
- Input belt with attachments, stop, toggles (Tools/Preview/Research/System), queued input.
- Sessions load/create, title updates, switching.
- Export JSON/Markdown.

## Persistence (Option A: UIMessage[])
### Client
- `useChat` is the source of truth for `UIMessage[]`.
- Optional: mirror minimal state to app store for UI flags.

### Server
- Persist full `UIMessage[]` to controller per session id.
- Load stored `UIMessage[]` as `messages` for `useChat` initial state.

## API Route: `/api/chat-v2`
Request body (via transport):
- `{ id: string; message: UIMessage; model?: string; system?: string; tools?: ToolDefinition[] }`

Server steps:
1) Load stored `UIMessage[]` for `id`.
2) Append incoming `message`.
3) Optionally `validateUIMessages` with tool schemas.
4) `streamText({ model, messages: await convertToModelMessages(validated), tools })`.
5) `return result.toUIMessageStreamResponse({ originalMessages, onFinish, consumeSseStream })`.
6) On finish, persist updated `UIMessage[]`.

## MCP Tool Flow (Client-side tools)
- Server defines tools without `execute` so tool calls stream to client.
- Client `onToolCall` executes MCP via controller and calls `addToolOutput`.
- Use `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`.

## Message Rendering Plan
- `text` parts: markdown render.
- `reasoning` parts: shown in thinking panel.
- `tool-*` and `dynamic-tool` parts: show tool input/output by state.
- `file` parts: show images/attachments.
- `step-start`: optional separators.

## Implementation Milestones
1) Scaffold `chat-v2` page and base layout.
2) Add `/api/chat-v2` streaming route.
3) Implement `ToolBelt` (send/stop + toggles).
4) Render messages by `parts`.
5) Build side panel from reasoning/tool parts.
6) Wire sessions + `UIMessage[]` persistence.
7) Add modals (settings/MCP/export/usage).
8) Parity and polish (mobile, queued context).

## Verification (when implemented)
- Manual: streaming, reasoning panel, tool calls, session reload.
- Automated: `npm run lint`, `npm run test` (frontend).
