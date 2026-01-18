import type { ToolCall, ToolResult, Artifact, ChatSession } from "@/lib/types";
import type { ResearchProgress, ResearchSource } from "@/components/chat/research-progress";

export interface ExtendedToolCall extends ToolCall {
  messageId: string;
  model?: string;
}

export interface ThinkingActivityItem {
  type: "thinking";
  id: string;
  content: string;
  isComplete: boolean;
  isStreaming: boolean;
}

export interface ToolActivityItem {
  type: "tool";
  id: string;
  toolCall: ExtendedToolCall;
}

export type ActivityItem = ThinkingActivityItem | ToolActivityItem;

export interface ChatSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePanel: "tools" | "artifacts";
  onSetActivePanel: (panel: "tools" | "artifacts") => void;
  allToolCalls: ExtendedToolCall[];
  toolResultsMap: Map<string, ToolResult>;
  executingTools: Set<string>;
  sessionArtifacts: Artifact[];
  researchProgress: ResearchProgress | null;
  researchSources: ResearchSource[];
  thinkingContent: string | null;
  thinkingActive: boolean;
  activityItems: ActivityItem[];
}

export interface SessionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd?: number | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  request_total_input_tokens?: number | null;
  request_prompt_tokens?: number | null;
  request_completion_tokens?: number | null;
  images?: string[];
  toolCalls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  toolResults?: Array<{
    tool_call_id: string;
    content: string;
    isError?: boolean;
  }>;
  isStreaming?: boolean;
  createdAt?: string;
}

// Usage Details Modal
export interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionUsage: SessionUsage | null;
  messages: Message[];
  selectedModel?: string;
}

export interface ChatMobileHeaderProps {
  currentSessionTitle: string;
  currentSessionId: string | null;
  sessions: ChatSession[];
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onOpenSidebar: () => void;
}

export type ChatMessage = Message;

export type RenderMessage = Message & {
  rawContent?: string | null;
  normalizedContent?: string | null;
};

export interface ChatMessageListProps {
  messages: Message[];
  currentSessionId?: string | null;
  bookmarkedMessages: Set<string>;
  artifactsEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  copiedIndex: number | null;
  renderDebug?: boolean;
  onCopy: (text: string, index: number) => void;
  onFork: (messageId: string) => void;
  onToggleBookmark: (messageId: string) => void;
}
