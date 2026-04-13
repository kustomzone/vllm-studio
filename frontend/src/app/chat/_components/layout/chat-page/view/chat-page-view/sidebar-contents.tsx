// CRITICAL
"use client";

import type { ReactNode } from "react";
import type { SidebarPanelContentMap } from "../../../sidebar/unified-sidebar/types";
import { PerfProfiler } from "../../../../perf/perf-profiler";
import { ActivityPanel, ContextPanel } from "../../../sidebar/chat-side-panel";
import { BrowserPanel } from "../../../sidebar/chat-side-panel/browser-panel";
import { ArtifactPreviewPanel } from "../../../../artifacts/artifact-preview-panel";
import { AgentFilesPanel } from "../../../../agent/agent-files-panel";
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
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-[2] min-h-0 overflow-hidden">
            <ComputerViewport
              currentToolCall={props.currentToolCall}
              runToolCalls={props.runToolCalls}
              isLoading={props.isLoading}
              runStatusLine={props.runStatusLine}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden border-t border-(--border)/40 flex flex-col">
            <div className="px-3 py-1.5 text-[11px] font-medium text-(--dim) border-b border-(--border)/20 bg-(--surface)/30 shrink-0">
              Browser
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <BrowserPanel activityGroups={props.activityGroups} isLoading={props.isLoading} />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden border-t border-(--border)/40">
            <AgentFilesPanel
              files={props.agentFiles}
              plan={props.agentPlan}
              selectedFilePath={props.selectedAgentFilePath}
              selectedFileContent={props.selectedAgentFileContent}
              selectedFileLoading={props.selectedAgentFileLoading}
              fileVersions={props.agentFileVersions}
              onSelectFile={props.onSelectAgentFile}
              hasSession={props.hasSession}
            />
          </div>
        </div>
      </PerfProfiler>
    ),
    activity: (
      <div className="h-full flex flex-col">
        <PerfProfiler id={`${prefix}activity-panel`}>
          <ActivityPanel
            activityGroups={props.activityGroups}
            agentPlan={props.agentPlan}
            isLoading={props.isLoading}
            runStatusLine={props.runStatusLine}
          />
        </PerfProfiler>
      </div>
    ),
    context: (
      <div className="p-4 overflow-y-auto h-full">
        <PerfProfiler id={`${prefix}context-panel`}>
          <ContextPanel
            stats={props.contextStats}
            breakdown={props.contextBreakdown}
            compactionHistory={props.compactionHistory}
            compacting={props.compacting}
            compactionError={props.compactionError}
            formatTokenCount={props.formatTokenCount}
            onCompact={props.runManualCompaction}
            canCompact={props.canManualCompact}
          />
        </PerfProfiler>
      </div>
    ),
    artifacts: (
      <PerfProfiler id={`${prefix}artifact-preview-panel`}>
        <ArtifactPreviewPanel artifacts={props.sessionArtifacts} />
      </PerfProfiler>
    ),
  };
}
