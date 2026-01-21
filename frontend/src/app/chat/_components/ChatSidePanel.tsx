"use client";

import { X, Wrench, Layers, Loader2, Check } from "lucide-react";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import type { ActivePanel, ActivityGroup } from "../types";
import type { Artifact } from "@/lib/types";

interface ChatSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePanel: ActivePanel;
  onSetActivePanel: (panel: ActivePanel) => void;
  activityGroups: ActivityGroup[];
  activityCount: number;
  thinkingActive: boolean;
  executingTools: Set<string>;
  artifacts: Artifact[];
}

export function ChatSidePanel({
  isOpen,
  onClose,
  activePanel,
  onSetActivePanel,
  activityGroups,
  activityCount,
  thinkingActive,
  executingTools,
  artifacts,
}: ChatSidePanelProps) {
  if (!isOpen) return null;

  const showPing = executingTools.size > 0 || thinkingActive;

  return (
    <div className="w-80 flex-shrink-0 border-l border-(--border) bg-(--background) flex flex-col overflow-hidden">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-(--border)">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSetActivePanel("activity")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              activePanel === "activity" ? "bg-(--accent)" : "text-[#9a9590] hover:bg-(--accent)/50"
            }`}
          >
            <Wrench className="h-3 w-3" />
            Activity
            {showPing && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute h-full w-full rounded-full bg-(--success) opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-(--success)" />
              </span>
            )}
            {activityCount > 0 && (
              <span className="text-[10px] bg-(--background) px-1 rounded">{activityCount}</span>
            )}
          </button>
          <button
            onClick={() => onSetActivePanel("artifacts")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              activePanel === "artifacts"
                ? "bg-(--accent)"
                : "text-[#9a9590] hover:bg-(--accent)/50"
            }`}
          >
            <Layers className="h-3 w-3" />
            Artifacts
            {artifacts.length > 0 && (
              <span className="text-[10px] bg-(--background) px-1 rounded">{artifacts.length}</span>
            )}
          </button>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-(--accent)" title="Close">
          <X className="h-3.5 w-3.5 text-[#9a9590]" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto text-sm">
        {activePanel === "activity" && <ActivityPanel activityGroups={activityGroups} />}
        {activePanel === "artifacts" && <ArtifactPanel artifacts={artifacts} isOpen={true} />}
      </div>
    </div>
  );
}

interface ActivityPanelProps {
  activityGroups: ActivityGroup[];
}

function ActivityPanel({ activityGroups }: ActivityPanelProps) {
  const getMainArg = (input?: unknown) => {
    if (input == null) return undefined;
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return String(input);
    }
    if (typeof input === "object") {
      const record = input as Record<string, unknown>;
      const candidate =
        record.query ?? record.url ?? record.text ?? record.input ?? Object.values(record)[0];
      if (candidate == null) return undefined;
      return String(candidate);
    }
    return undefined;
  };

  const stripMarkdown = (value: string) =>
    value
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""))
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/[*_~>]+/g, "")
      .trim();

  const activityEmpty = activityGroups.length === 0;

  return (
    <>
      {activityGroups.map((group) => (
        <div key={group.id} className="border-b border-(--border)">
          <div className={`px-3 py-2 ${group.isLatest ? "bg-(--accent)/50" : "bg-(--accent)/20"}`}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9a9590]">
              <span>{group.title}</span>
              <span className="font-mono">
                {group.toolItems.length} tool{group.toolItems.length === 1 ? "" : "s"}
                {group.thinkingContent ? " • reasoning" : ""}
              </span>
            </div>
          </div>

          <div className="relative px-3 pb-2">
            <div className="absolute left-4 top-3 bottom-3 w-px bg-(--border)/70" />
            <div className="flex flex-col gap-2 pl-4">
              {group.thinkingActive && (
                <div className="relative">
                  <span className="absolute left-[-13px] top-2 h-2 w-2 rounded-full bg-blue-500" />
                  <div className="flex items-center gap-2 text-xs text-[#9a9590]">
                    <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}

              {group.thinkingContent && (
                <div className="relative">
                  <span className="absolute left-[-13px] top-2 h-2 w-2 rounded-full bg-[#9a9590]" />
                  <div className="text-[10px] uppercase tracking-wider text-[#9a9590] mb-1">
                    Reasoning
                  </div>
                  <p className="text-[11px] text-[#9a9590] whitespace-pre-wrap break-words max-h-48 overflow-auto">
                    {stripMarkdown(group.thinkingContent)}
                  </p>
                </div>
              )}

              {group.toolItems.map((item) => {
                const isExecuting = item.state === "running";
                const hasResult = item.output != null;
                const isError = item.state === "error";
                const mainArg = getMainArg(item.input);
                const outputText =
                  typeof item.output === "string"
                    ? item.output
                    : item.output != null
                      ? JSON.stringify(item.output, null, 2)
                      : "";

                return (
                  <div
                    key={item.id}
                    className={`relative rounded border border-(--border)/50 px-2 py-2 ${
                      isExecuting ? "bg-(--warning)/5" : "bg-(--background)"
                    }`}
                  >
                    <span className="absolute left-[-13px] top-3 h-2 w-2 rounded-full bg-(--accent)" />
                    <div className="flex items-center gap-2">
                      {isExecuting ? (
                        <Loader2 className="h-3 w-3 text-(--warning) animate-spin" />
                      ) : hasResult ? (
                        isError ? (
                          <X className="h-3 w-3 text-(--error)" />
                        ) : (
                          <Check className="h-3 w-3 text-(--success)" />
                        )
                      ) : (
                        <Wrench className="h-3 w-3 text-[#9a9590]" />
                      )}
                      <span className="text-xs font-medium truncate">
                        {item.toolName || "tool"}
                      </span>
                    </div>
                    {mainArg && (
                      <p className="text-[11px] text-[#9a9590] mt-1 line-clamp-2 pl-5">
                        {mainArg.slice(0, 80)}
                      </p>
                    )}
                    {outputText && !isExecuting && (
                      <p
                        className={`text-[11px] font-mono line-clamp-3 mt-1.5 pl-5 ${
                          isError ? "text-(--error)" : "text-[#9a9590]"
                        }`}
                      >
                        {stripMarkdown(outputText).slice(0, 150)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {activityEmpty && (
        <div className="px-3 py-6 text-center text-xs text-[#9a9590]">No activity yet</div>
      )}
    </>
  );
}
