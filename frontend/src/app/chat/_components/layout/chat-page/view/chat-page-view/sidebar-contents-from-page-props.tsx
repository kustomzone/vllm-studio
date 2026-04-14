// CRITICAL
"use client";

import type { AgentFileEntry, AgentFileVersion, Artifact } from "@/lib/types";
import type { AgentPlan } from "../../../../agent/agent-types";
import type { ActivityGroup } from "../../../../../types";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import type { CompactionEvent, ContextStats } from "@/lib/services/context-management";
import { buildSidebarContents, type SidebarContentsVariant } from "./sidebar-contents";

export type ChatPageSidebarInputs = {
  activityGroups: ActivityGroup[];
  agentPlan: AgentPlan | null;
  isLoading: boolean;
  runStatusLine: string;

  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];

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
  compactionHistory: CompactionEvent[];
  compacting: boolean;
  compactionError: string | null;
  formatTokenCount: (tokens: number) => string;
  runManualCompaction: () => void;
  canManualCompact: boolean;

  sessionArtifacts: Artifact[];

  agentFiles: AgentFileEntry[];
  agentFileVersions: Record<string, AgentFileVersion[]>;
  selectedAgentFilePath: string | null;
  selectedAgentFileContent: string | null;
  selectedAgentFileLoading: boolean;
  onSelectAgentFile: (path: string | null) => void;
  computerBrowserUrl: string;
  setComputerBrowserUrl: (url: string) => void;
  hasSession: boolean;
};

export function buildSidebarContentsFromPageProps(
  variant: SidebarContentsVariant,
  props: ChatPageSidebarInputs,
) {
  return buildSidebarContents({
    variant,
    activityGroups: props.activityGroups,
    agentPlan: props.agentPlan,
    isLoading: props.isLoading,
    runStatusLine: props.runStatusLine,
    currentToolCall: props.currentToolCall,
    runToolCalls: props.runToolCalls,
    contextStats: props.contextStats,
    contextBreakdown: props.contextBreakdown,
    compactionHistory: props.compactionHistory,
    compacting: props.compacting,
    compactionError: props.compactionError,
    formatTokenCount: props.formatTokenCount,
    runManualCompaction: props.runManualCompaction,
    canManualCompact: props.canManualCompact,
    sessionArtifacts: props.sessionArtifacts,
    agentFiles: props.agentFiles,
    agentFileVersions: props.agentFileVersions,
    selectedAgentFilePath: props.selectedAgentFilePath,
    selectedAgentFileContent: props.selectedAgentFileContent,
    selectedAgentFileLoading: props.selectedAgentFileLoading,
    onSelectAgentFile: props.onSelectAgentFile,
    computerBrowserUrl: props.computerBrowserUrl,
    setComputerBrowserUrl: props.setComputerBrowserUrl,
    hasSession: props.hasSession,
  });
}
