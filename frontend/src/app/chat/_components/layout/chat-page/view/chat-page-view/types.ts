// CRITICAL
"use client";

import type { ReactNode, RefObject } from "react";
import type { SidebarTab } from "../../../sidebar/unified-sidebar";
import type {
  AgentFileEntry,
  AgentFileVersion,
  Artifact,
  ChatMessage,
  SessionUsage,
} from "@/lib/types";
import type { AgentPlan } from "../../../../agent/agent-types";
import type { ActivityGroup, ModelOption } from "../../../../../types";
import type { CompactionEvent, ContextStats } from "@/lib/services/context-management";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import type { DeepResearchConfig } from "@/lib/types";

export interface ChatPageViewProps {
  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  // Activity + context
  activityGroups: ActivityGroup[];
  activityCount: number;
  agentPlan: AgentPlan | null;
  thinkingActive: boolean;
  isLoading: boolean;
  streamError: string | null;
  onDismissStreamError: () => void;
  streamStalled: boolean;
  runStatusLine: string;
  contextStats?: Omit<
    ContextStats,
    "compactionHistory" | "lastCompaction" | "totalCompactions" | "totalTokensCompacted"
  > | null;
  contextBreakdown?: {
    messages: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    userTokens: number;
    assistantTokens: number;
    thinkingTokens: number;
  } | null;
  contextUsageLabel: string | null;
  compactionHistory: CompactionEvent[];
  compacting: boolean;
  compactionError: string | null;
  formatTokenCount: (tokens: number) => string;
  runManualCompaction: () => void;
  canManualCompact: boolean;

  // Artifacts
  artifactsEnabled: boolean;
  sessionArtifacts: Artifact[];
  artifactsByMessage: Map<string, Artifact[]>;
  activeArtifact: Artifact | null;
  onCloseArtifactModal: () => void;

  // Agent files
  agentFiles: AgentFileEntry[];
  agentFileVersions: Record<string, AgentFileVersion[]>;
  selectedAgentFilePath: string | null;
  selectedAgentFileContent: string | null;
  selectedAgentFileLoading: boolean;
  onSelectAgentFile: (path: string | null) => void;
  /** Embedded Computer browser (iframe); model can set via browser_open_url. */
  computerBrowserUrl: string;
  setComputerBrowserUrl: (url: string) => void;
  hasSession: boolean;
  onOpenAgentFile: (path: string) => void;

  // Messages + list refs
  messages: ChatMessage[];
  currentSessionId: string | null;
  agentFilesBrowsePath: string;
  selectedModel: string;
  showEmptyState: boolean;
  onForkMessage: (messageId: string) => void;
  onReprompt: (messageId: string) => void;
  onListenMessage: (messageId: string) => void;
  listeningMessageId: string | null;
  listeningPending: boolean;
  openActivityPanel: () => void;
  openContextPanel: () => void;
  /** Agent mode: open sidebar to Computer (files + tool output). */
  onOpenComputerPanel: () => void;
  /** Left chat rail / mobile drawer: actions (list state is read inside `ChatHistoryDock`). */
  onRefreshChatSessions: () => void;
  onActivateChatSession: (sessionId: string) => void | Promise<void>;
  onNewChatSession: () => void;
  onDeleteChatSession: (sessionId: string) => void | Promise<void>;
  onRenameChatSession: (sessionId: string, title: string) => void | Promise<void>;
  agentMode: boolean;
  executingToolsSize: number;
  handleScroll: () => void;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;

  toolBelt: ReactNode;

  // Modals
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  usageOpen: boolean;
  setUsageOpen: (open: boolean) => void;
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  setSelectedModel: (modelId: string) => void;
  availableModels: ModelOption[];
  customChatModels: string[];
  onAddCustomChatModel: (modelId: string) => void;
  onRemoveCustomChatModel: (modelId: string) => void;
  deepResearch: DeepResearchConfig;
  setDeepResearch: (next: DeepResearchConfig) => void;
  sessionUsage: SessionUsage | null;
  onExportJson: () => void;
  onExportMarkdown: () => void;
}
