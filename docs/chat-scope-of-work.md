# Chat Page — Scope of Work

> Full rewrite of `/chat`. The current implementation is 142 files / ~16k lines
> with deeply nested controller indirection that makes changes fragile. This
> document defines what chat should be, what stays, what goes, and the exact
> architecture for the replacement.

---

## 1. What's Wrong Today

### State spaghetti
`useChatPageController` (200 lines) calls `useChatPageStore` → `useChatDerived` →
`useThinkingSnippet` → `useChatPageControllerTail` (300 lines, mostly TTS) →
`useChatUiActions` → `useChatSidebarController`. Each layer threads 20-50 props
to the next. `ChatPageViewProps` has 100+ fields. A single state change (e.g.
"a tool call completed") triggers re-renders through all of them.

### Derived state is expensive and redundant
`buildActivityGroups` walks every message, every part, categorizes every tool,
groups by run — O(messages × parts) on every render. The result is a complex
`ActivityGroup[]` that gets passed to `ActivityPanel`, `WorkspacePanel`, and
`BrowserPanel` — three components that all render the same data differently.

### Sidebar is confused
Three tabs (Activity / Workspace / Artifacts) with overlapping concerns:
- Activity panel: flat list of tool calls with dots
- Workspace panel: browser screenshots + file tree + context stats (unrelated things)
- Browser panel: also in workspace, duplicates activity's web items

None of them give the user a clear picture of what the agent is doing.

### Tool calls are invisible in chat
Tool-only assistant messages are filtered out (`isToolOnlyMessage` → hidden).
The user sees the agent "thinking" with dots, then a wall of text appears.
There's no narrative of what happened between turns.

### Message visibility logic is a minefield
`filterVisibleMessages` has multiple code paths for loading vs. completed
states, with subtle bugs around when to show/hide intermediate turns. The
"hide tool-call turns during loading" logic (`currentRunStart`) interacts
badly with the streaming message detection.

---

## 2. Target Experience

Reference: Kimi's "Computer Use" UI (screenshots in `reports/activity-panel-mockup.html`).

### Layout
```
┌─────────────────────────────┬──────────────────────────────────┐
│                             │                                  │
│     Chat Conversation       │      Agent's Computer            │
│                             │                                  │
│  [user message]             │  ┌────────────────────────────┐  │
│                             │  │ header: status + breadcrumb│  │
│  [thinking block]           │  ├────────────────────────────┤  │
│  [assistant text]           │  │ action tabs (per tool call)│  │
│  [tool call row]            │  ├────────────────────────────┤  │
│  [tool call row]            │  │                            │  │
│  [tool call row]            │  │   live viewport            │  │
│                             │  │   (terminal / file /       │  │
│  [assistant text]           │  │    browser / todo)         │  │
│                             │  │                            │  │
│  ┌────────────────────────┐ │  └────────────────────────────┘  │
│  │ composer               │ │                                  │
│  └────────────────────────┘ │                                  │
└─────────────────────────────┴──────────────────────────────────┘
```

### Chat pane (left)
- User messages: bubble, right-aligned
- Assistant messages contain three distinct block types rendered in order:
  1. **Thinking block**: collapsible, shows reasoning content (purple accent).
     While streaming: expanded with typing cursor. When done: collapses to
     "Thought for N seconds" one-liner with expand chevron.
  2. **Text content**: rendered markdown, same as today.
  3. **Tool call rows**: compact rows for each tool call part in the message.
     Each row: category icon (terminal/file/globe/search/plan) + label +
     target (file path, URL, command) + status indicator (spinner while
     running, checkmark when done, red ! on error) + chevron. Clicking a
     row focuses the Computer viewport on that tool's output.
- Tool-only messages (no text, only tool parts) are NOT hidden. They render
  as a stack of tool call rows. This gives the user a visible record of
  every action the agent took.
- Plan steps: shown inline as a numbered checklist when the agent creates a
  plan. Each step has a status icon (pending circle, spinning loader, green
  check, red blocked). Same as current `AgentPlanDrawer` but rendered inline
  in the message flow, not in a separate drawer.

### Computer pane (right)
A live viewport showing what the agent is currently doing, or the output of
the last action. It reacts to a single signal: the **currently active tool
call** (or the most recently completed one).

**Header bar**: "Agent's Computer" title + status dot (idle/working/done) +
breadcrumb showing the current target (file path, URL, command).

**Action tab bar**: one tab per tool call in the current run. Each tab shows
the tool's display name and a spinner while running. Clicking a tab shows
that tool's output in the viewport. New running tools auto-focus.

**Viewport** switches between views based on tool category:

| Tool category | View | What it shows |
|---|---|---|
| `execute_command`, `bash`, `shell`, `computer_use` | **Terminal** | Prompt (`$`) + command + output. Blinking cursor while running. Green/red output coloring. |
| `read_file`, `list_files` | **File (read)** | File path header + line numbers + content. Blue "Reading" badge. |
| `write_file`, `create_file` | **File (write)** | File path header + line numbers + green diff-highlighted lines. Green "Creating" badge. Typing cursor on last line while writing. |
| `edit_file` | **File (edit)** | File path header + mixed green (add) / red (del) diff lines. Orange "Editing" badge. |
| `web_search`, `grep`, `find`, `search` | **Browser (search)** | URL bar + search query display + results content. |
| `fetch_url`, `browse`, `http_request` | **Browser (fetch)** | URL bar with domain highlighted + page content. |
| `create_plan`, `update_plan` | **Todo** | Checkbox list matching the plan steps. Done items checked (green), active item with spinner, pending items unchecked. |
| anything else | **Terminal** (fallback) | Raw input/output display. |

**Idle state**: centered monitor icon + "Waiting for activity..." when no
tool calls exist.

**Artifact preview**: keep `ArtifactModal` for full-screen artifact viewing
(already exists). Remove the "Preview" sidebar tab — artifacts are triggered
from the mini-cards in chat messages.

---

## 3. Architecture

### State model (what replaces the current mess)

```
useChatPageController
  ├── useChatPageStore          (zustand slice — unchanged)
  ├── useChatMessages           (message array — unchanged)
  ├── useRunMachine             (SSE streaming — unchanged)
  ├── useChatSessions           (session CRUD — unchanged)
  ├── useChatMessageMapping     (part mapping — unchanged)
  ├── useChatToolResults        (tool result tracking — unchanged)
  ├── useChatContext            (token counting — unchanged)
  ├── useChatCompaction         (context compaction — unchanged)
  ├── useChatScroll             (scroll behavior — unchanged)
  ├── useChatArtifacts          (artifact extraction — unchanged)
  ├── useAvailableModels        (model list — unchanged)
  │
  ├── useCurrentToolCall  ← NEW (replaces buildActivityGroups for viewport)
  ├── useRunToolCalls     ← NEW (all tools in current run, for tab bar)
  ├── useTTS              ← NEW (extracted from controller-tail)
  │
  ├── useChatPageLifecycle      (bootstrap + timers — unchanged)
  └── useChatPageTimers         (elapsed time — unchanged)

  DELETED:
  - useChatPageControllerTail   (300-line prop-threading + TTS → split out)
  - useChatUiActions            (inline the 5 callbacks)
  - useChatSidebarController    (trivial: open on isLoading, default to computer)
  - useChatDerived              (activityGroups no longer needed)
  - useThinkingSnippet          (keep buildRunStatusText, call it directly)
  - buildActivityGroups         (entire file deleted)
```

### New hooks

**`useCurrentToolCall(messages, executingTools, toolResultsMap)`**
Returns `CurrentToolCall | null` — the single tool call to display in the
viewport. Logic: walk messages backwards, find last assistant message with
tool parts, return the last running one (or last completed if none running).

```ts
interface CurrentToolCall {
  toolCallId: string;
  toolName: string;
  category: "file" | "edit" | "code" | "web" | "search" | "plan" | "other";
  input?: unknown;
  output?: unknown;
  state: "pending" | "running" | "complete" | "error";
  target?: string; // extracted file path, URL, command
}
```

**`useRunToolCalls(messages, executingTools, toolResultsMap)`**
Returns `CurrentToolCall[]` — all tool calls from the current run (after
the last user message). Used for the action tab bar.

**`useTTS(messages)`**
Extracted from `useChatPageControllerTail`. Encapsulates: `listeningMessageId`,
`listeningPending`, `onListenMessage`, `stopListening`, `audioRef`,
`speakAbortRef`. No longer threads through the controller pipeline.

### New components

**`ComputerViewport`** — orchestrator component.
Props: `currentToolCall`, `runToolCalls`, `isLoading`, `runStatusLine`.
Renders header + tab bar + delegates to sub-view.

**`TerminalView`** — extracts command from input, formats output, shows
blinking cursor while running.

**`FileView`** — extracts file path and content, renders with line numbers
and diff highlighting. Action badge (Reading/Creating/Editing).

**`BrowserView`** — extracts URL, renders URL bar and content.

**`TodoView`** — parses plan steps from input/output, renders checkbox list.

**`ThinkingBlock`** — collapsible reasoning block for assistant messages.
Props: `content: string`, `isActive: boolean`. Expanded while active,
collapses on completion.

**`ToolCallRow`** — compact inline tool call status row for assistant messages.
Props: `part` (tool part from message), `isExecuting`, `hasResult`, `isError`.
Reads category from tool name, shows icon + label + target + status.

### Components to delete

| File | Reason |
|---|---|
| `activity-panel.tsx` | Replaced by ComputerViewport + inline ToolCallRows |
| `turn-group.tsx` | Was used by activity panel |
| `tool-item.tsx` | Was used by activity panel |
| `thinking-item.tsx` | Replaced by ThinkingBlock in message |
| `browser-panel.tsx` | Merged into ComputerViewport BrowserView |
| `tool-categorization.ts` | Simplified into useCurrentToolCall |
| `build-activity-groups.ts` | Entire pipeline deleted |
| `workspace-panel.tsx` | Browser section → ComputerViewport, Files section → drop or move to modal, Context section → settings modal |
| `chat-side-panel.tsx` | Barrel export — no longer needed |
| `chat-side-panel-context.tsx` | Move context stats to settings or inline indicator |
| `sidebar-contents.tsx` | Rewrite to only build computer + artifacts |
| `sidebar-contents-from-page-props.tsx` | Simplify alongside sidebar-contents |
| `use-chat-page-controller-tail.tsx` | Flatten into controller + useTTS |
| `use-chat-sidebar-controller.ts` | Trivialize: 3 lines of auto-open logic |
| `use-chat-ui-actions.tsx` | Inline callbacks into controller |

### Components to modify

| File | Change |
|---|---|
| `chat-message-item.tsx` | Add ThinkingBlock + ToolCallRow rendering. Read `executingTools`/`toolResultsMap` from zustand store directly (no prop threading). |
| `visible-messages.ts` | Stop hiding tool-only messages. Show them as compact tool call rows. Keep the "only show latest streaming message during loading" behavior. |
| `use-chat-page-controller.tsx` | Remove controller-tail, ui-actions, sidebar-controller indirection. Call useCurrentToolCall + useRunToolCalls + useTTS directly. Produce a slimmer ChatPageViewProps. |
| `chat-page-view.tsx` | Remove tab switching logic. Right pane is always ComputerViewport. |
| `unified-sidebar.tsx` | Remove tab bar when only one panel (Computer). Show tabs only when artifacts exist. |
| `panel-registry.ts` | Two entries: Computer (always) + Artifacts (when present). |
| `types.ts` (sidebar) | `SidebarTab = "computer" \| "artifacts"` |
| `ChatPageViewProps` | Remove: `activityGroups`, `activityCount`, `agentPlan` (for sidebar), workspace panel props. Add: `currentToolCall`, `runToolCalls`. |

---

## 4. Data Flow

### Current (bad)
```
messages → buildActivityGroups() → ActivityGroup[] → ActivityPanel
                                                   → WorkspacePanel
                                                   → BrowserPanel
         → extractThinking() → ThinkingState → useThinkingSnippet → statusLine
         → useChatDerived → thinkingActive, hasToolActivity, etc.
```
Every message change recomputes everything. ActivityGroups walks all messages.

### Target (good)
```
messages → useCurrentToolCall()  → CurrentToolCall | null  → ComputerViewport
         → useRunToolCalls()     → CurrentToolCall[]       → ComputerViewport tab bar
         → buildRunStatusText()  → string                  → header status line

Each message renders its own:
  message.parts → ThinkingBlock (reasoning parts)
               → ToolCallRow[] (tool parts, read executingTools from store)
               → MessageRenderer (text parts)
```
No intermediate data structures. Each component reads what it needs.

---

## 5. Migration Plan

This is NOT an incremental refactor. The previous attempt (adding new
components alongside old ones) broke because the old and new systems
conflicted on message visibility, sidebar state, and prop expectations.

### Approach: parallel branch, swap in one shot

1. **Branch**: Create `feature/chat-v2` off `dev`.

2. **Phase 1 — New components (no wiring)**:
   Build ComputerViewport, TerminalView, FileView, BrowserView, TodoView,
   ThinkingBlock, ToolCallRow, useCurrentToolCall, useRunToolCalls, useTTS
   as standalone files with no imports from the old system. Write unit tests
   for useCurrentToolCall and useRunToolCalls.

3. **Phase 2 — New controller**:
   Write a new `useChatPageController` that produces a slimmer
   `ChatPageViewProps`. It calls the new hooks and skips the old
   controller-tail/ui-actions/sidebar-controller chain. Wire it to a new
   `ChatPageView` that renders ChatConversation (left) + ComputerViewport
   (right). Don't touch the old components yet.

4. **Phase 3 — New message rendering**:
   Modify `chat-message-item.tsx` to render ThinkingBlock and ToolCallRows.
   Modify `visible-messages.ts` to show tool-only messages. This is the
   breaking change — do it in the same commit as the controller swap so
   there's no half-old-half-new state.

5. **Phase 4 — Delete old code**:
   Remove activity-panel, workspace-panel, browser-panel, turn-group,
   tool-item, thinking-item, tool-categorization, build-activity-groups,
   controller-tail, ui-actions, sidebar-controller. Remove unused
   ActivityGroup/ThinkingState types if nothing else references them.

6. **Phase 5 — Polish**:
   Transitions/animations, responsive behavior, mobile drawer adaptation,
   keyboard navigation, test on real agent sessions.

7. **Merge**: Squash-merge `feature/chat-v2` into `dev`.

### Risk mitigation
- Keep the mockup (`reports/activity-panel-mockup.html`) as the visual spec.
  Open it side-by-side while building.
- Test with real agent sessions at every phase, not just `next build`.
- The old `/chat` code stays intact on `dev` until the branch merges.

---

## 6. What Stays Untouched

These systems are solid and should not be rewritten:

- `useRunMachine` / `chat-run-stream.ts` — SSE streaming engine
- `useChatSessions` / `chat-session-bootstrap.ts` — session persistence
- `useChatMessageMapping` — message part mapping from server format
- `useChatToolResults` — tool result tracking
- `useChatContext` / `useChatCompaction` — context window management
- `useChatScroll` — scroll-to-bottom behavior
- `useChatArtifacts` — artifact extraction from messages
- `MessageRenderer` — markdown rendering
- `UserMessage` — user message bubble
- `ChatConversation` — scroll container + Virtuoso list (minor mods only)
- `ChatModals` — settings/usage/export modals
- `ArtifactModal` / `MiniArtifactCard` — artifact viewing
- `AgentPlanDrawer` — may be repurposed for inline plan display
- `ChatToolbeltDock` / `ToolBelt` — composer and toolbar
- `run-status.ts` / `buildRunStatusText` — status line generation
- `agent-system-prompt.ts` — system prompt construction
- Store slices (`chat-slice`, `theme-slice`, etc.)

---

## 7. File Count Estimate

| Category | Current | After |
|---|---|---|
| Hooks | 25 | 20 (−5 deleted, +3 new) |
| Components (chat page) | 45 | 35 (−15 deleted, +5 new) |
| Components (sidebar) | 12 | 5 (−7 deleted) |
| Types | 8 | 6 (−2 simplified) |
| Utils | 6 | 5 (−1 deleted) |
| **Total** | **~96 chat-specific** | **~71** |
| **Lines** | **~16k** | **~12k** (estimated −4k) |

---

## 8. Open Questions

1. **Agent files tree**: The workspace panel had a file tree for agent-created
   files. Where does this go? Options: (a) section in ComputerViewport below
   the live view, (b) collapsible drawer in chat, (c) drop it.

2. **Context stats**: Currently in workspace panel. Options: (a) small inline
   badge in chat footer showing "ctx 45%", (b) move to settings modal,
   (c) keep a minimal section in ComputerViewport.

3. **Mobile**: Current mobile uses `MobileResultsDrawer` (bottom sheet).
   The Computer viewport should probably be a full-screen overlay on mobile,
   triggered by tapping the activity indicator. Need to design this.

4. **Screenshots**: The workspace panel extracts base64 screenshots from tool
   outputs and shows them. ComputerViewport should do this too — probably as
   an image rendered inside the BrowserView or TerminalView when screenshot
   data is detected in the output.
