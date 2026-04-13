// CRITICAL
"use client";

import type { ReactNode } from "react";
import type { SidebarPanelContentMap } from "../../../sidebar/unified-sidebar/types";
import { PerfProfiler } from "../../../../perf/perf-profiler";
import { ArtifactPreviewPanel } from "../../../../artifacts/artifact-preview-panel";
import { ComputerViewport } from "../../../../computer-viewport";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import type { AgentFileEntry, AgentFileVersion, Artifact } from "@/lib/types";
import type { AgentPlan } from "../../../../agent/agent-types";
import type { ActivityGroup } from "../../../../../types";
import type { CompactionEvent, ContextStats } from "@/lib/services/context-management";

export type SidebarContentsVariant = "mobile" | "desktop";

export type SidebarContentsProps = {
  variant: SidebarContentsVariant;
  activityGroups: ActivityGroup[];
  agentPlan: AgentPlan | null;
  isLoading: boolean;
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
  compactionHistory: CompactionEvent[];
  compacting: boolean;
  compactionError: string | null;
  formatTokenCount: (tokens: number) => string;
  runManualCompaction: () => void;
  canManualCompact: boolean;

  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];

  sessionArtifacts: Artifact[];

  agentFiles: AgentFileEntry[];
  agentFileVersions: Record<string, AgentFileVersion[]>;
  selectedAgentFilePath: string | null;
  selectedAgentFileContent: string | null;
  selectedAgentFileLoading: boolean;
  onSelectAgentFile: (path: string | null) => void;
  hasSession: boolean;
};

export function buildSidebarContents(props: SidebarContentsProps): SidebarPanelContentMap {
  const prefix = props.variant === "mobile" ? "mobile-" : "";

  return {
    computer: (
      <PerfProfiler id={`${prefix}computer-viewport`}>
        <ComputerViewport
          currentToolCall={props.currentToolCall}
          runToolCalls={props.runToolCalls}
          isLoading={props.isLoading}
          runStatusLine={props.runStatusLine}
        />
      </PerfProfiler>
    ),
    artifacts: (
      <PerfProfiler id={`${prefix}artifact-preview-panel`}>
        <ArtifactPreviewPanel artifacts={props.sessionArtifacts} />
      </PerfProfiler>
    ),
  };
}
