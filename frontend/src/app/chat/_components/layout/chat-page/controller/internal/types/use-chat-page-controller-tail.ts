// CRITICAL
import type { MutableRefObject } from "react";
import type { ChatMessage } from "@/lib/types";
import type { ChatPageViewProps } from "@/app/chat/_components/layout/chat-page/view/chat-page-view/types";
import type {
  AgentFilesService,
  ChatPageStore,
  ChatRunEvent,
  ChatSessionsService,
  ChatToolsService,
  MessagesContainerRef,
  MessagesEndRef,
  RouterLike,
  SessionIdRef,
  SetMessages,
} from "./controller-types";

export interface UseChatPageControllerTailArgs {
  store: ChatPageStore;
  sessions: ChatSessionsService;
  tools: ChatToolsService;
  agentFiles: AgentFilesService;
  router: RouterLike;
  sessionFromUrl: string | null;
  /** When true, ignore missing `session` in URL for sync (new-chat / reset in flight). */
  sessionUrlSyncSuppressedRef: MutableRefObject<boolean>;

  sidebarOpen: boolean;
  setSidebarOpen: (next: boolean) => void;
  sidebarTab: ChatPageViewProps["sidebarTab"];
  setSidebarTab: (next: ChatPageViewProps["sidebarTab"]) => void;

  messages: ChatMessage[];
  setMessages: SetMessages;

  isLoading: boolean;
  streamError: string | null;
  streamStalled: boolean;
  setStreamError: (next: string | null) => void;
  setIsLoading: (next: boolean) => void;
  setStreamStalled: (next: boolean) => void;
  setUsageOpen: (open: boolean) => void;

  clearPlan: () => void;
  lastUserInputRef: MutableRefObject<string>;
  handleRunEvent: (event: ChatRunEvent) => void;

  activeRunIdRef: { current: string | null };
  runAbortControllerRef: { current: AbortController | null };
  runCompletedRef: { current: boolean };
  lastEventTimeRef: { current: number };
  sessionIdRef: SessionIdRef;

  activityPanelVisible: boolean;
  currentToolCall: ChatPageViewProps["currentToolCall"];
  runToolCalls: ChatPageViewProps["runToolCalls"];
  thinkingActive: boolean;
  activityGroups: ChatPageViewProps["activityGroups"];
  activityCount: number;
  thinkingSnippet: string;
  executingToolsSize: number;

  contextStats: ChatPageViewProps["contextStats"];
  contextBreakdown: ChatPageViewProps["contextBreakdown"];
  contextUsageLabel: ChatPageViewProps["contextUsageLabel"];
  compactionHistory: ChatPageViewProps["compactionHistory"];
  compacting: boolean;
  compactionError: string | null;
  formatTokenCount: (tokens: number) => string;
  runManualCompaction: () => void;
  canManualCompact: boolean;

  sessionArtifacts: ChatPageViewProps["sessionArtifacts"];
  artifactsByMessage: ChatPageViewProps["artifactsByMessage"];
  activeArtifact: ChatPageViewProps["activeArtifact"];

  handleScroll: () => void;
  messagesContainerRef: MessagesContainerRef;
  messagesEndRef: MessagesEndRef;

  activateSessionFromHistory: (sessionId: string) => Promise<void>;
  openNewChatFromSidebar: () => void;
  deleteChatSessionFromSidebar: (sessionId: string) => Promise<void>;
}
