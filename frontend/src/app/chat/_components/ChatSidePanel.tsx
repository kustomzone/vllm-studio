"use client";

import { X, Wrench, Layers, Loader2, Check } from "lucide-react";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import type { ActivePanel, ActivityItem } from "../types";
import type { Artifact } from "@/lib/types";

interface ChatSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePanel: ActivePanel;
  onSetActivePanel: (panel: ActivePanel) => void;
  thinkingContent: string;
  thinkingActive: boolean;
  activityItems: ActivityItem[];
  executingTools: Set<string>;
  artifacts: Artifact[];
}

export function ChatSidePanel({
  isOpen,
  onClose,
  activePanel,
  onSetActivePanel,
  thinkingContent,
  thinkingActive,
  activityItems,
  executingTools,
  artifacts,
}: ChatSidePanelProps) {
  if (!isOpen) return null;

  const activityCount = activityItems.length + (thinkingContent ? 1 : 0);
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
        {activePanel === "activity" && (
          <ActivityPanel
            thinkingContent={thinkingContent}
            thinkingActive={thinkingActive}
            activityItems={activityItems}
          />
        )}
        {activePanel === "artifacts" && <ArtifactPanel artifacts={artifacts} isOpen={true} />}
      </div>
    </div>
  );
}

interface ActivityPanelProps {
  thinkingContent: string;
  thinkingActive: boolean;
  activityItems: ActivityItem[];
}

function ActivityPanel({ thinkingContent, thinkingActive, activityItems }: ActivityPanelProps) {
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

  const activityEmpty = activityItems.length === 0 && !thinkingContent && !thinkingActive;

  return (
    <>
      {thinkingActive && (
        <div className="px-3 py-2 border-b border-(--border) bg-blue-500/5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
            <span className="text-xs">Thinking...</span>
          </div>
        </div>
      )}

      {thinkingContent && (
        <div className="px-3 py-2 border-b border-(--border)">
          <div className="text-[10px] uppercase tracking-wider text-[#9a9590] mb-1">Reasoning</div>
          <pre className="text-[11px] text-[#9a9590] whitespace-pre-wrap break-words max-h-48 overflow-auto">
            {thinkingContent}
          </pre>
        </div>
      )}

      {activityItems.map((item) => {
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
            className={`px-3 py-2 border-b border-(--border) ${
              isExecuting ? "bg-(--warning)/5" : ""
            }`}
          >
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
              <span className="text-xs font-medium truncate">{item.toolName || "tool"}</span>
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
                {outputText.slice(0, 150)}
              </p>
            )}
          </div>
        );
      })}

      {activityEmpty && (
        <div className="px-3 py-6 text-center text-xs text-[#9a9590]">No activity yet</div>
      )}
    </>
  );
}
