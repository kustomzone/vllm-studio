"use client";

import { X, Brain, Wrench, Loader2 } from "lucide-react";
import type { ActivePanel, ActivityItem } from "../types";

interface ChatSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activePanel: ActivePanel;
  onSetActivePanel: (panel: ActivePanel) => void;
  thinkingContent: string;
  thinkingActive: boolean;
  activityItems: ActivityItem[];
}

export function ChatSidePanel({
  isOpen,
  onClose,
  activePanel,
  onSetActivePanel,
  thinkingContent,
  thinkingActive,
  activityItems,
}: ChatSidePanelProps) {
  if (!isOpen) return null;

  return (
    <div className="w-80 lg:w-96 border-l border-[var(--border)] bg-[var(--card)] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetActivePanel("tools")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePanel === "tools"
                ? "bg-[var(--accent)] text-[#e8e4dd]"
                : "text-[#9a9590] hover:text-[#c8c4bd]"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            Tools
          </button>
          <button
            onClick={() => onSetActivePanel("artifacts")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activePanel === "artifacts"
                ? "bg-[var(--accent)] text-[#e8e4dd]"
                : "text-[#9a9590] hover:text-[#c8c4bd]"
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            Thinking
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-[var(--accent)]"
          title="Close panel"
        >
          <X className="h-4 w-4 text-[#9a9590]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activePanel === "tools" && (
          <div className="space-y-3">
            {activityItems.length === 0 && (
              <div className="text-sm text-[#6a6560] text-center py-8">
                No tool activity yet
              </div>
            )}
            {activityItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.state === "running" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--link)]" />
                  )}
                  <span className="font-mono text-sm text-[#c8c4bd]">
                    {item.toolName}
                  </span>
                  <span
                    className={`text-xs ${
                      item.state === "complete"
                        ? "text-[var(--success)]"
                        : item.state === "error"
                          ? "text-[var(--error)]"
                          : "text-[#6a6560]"
                    }`}
                  >
                    {item.state}
                  </span>
                </div>
                {item.output != null && (
                  <pre className="text-xs text-[#9a9590] overflow-x-auto max-h-32 overflow-y-auto">
                    {typeof item.output === "string"
                      ? String(item.output).slice(0, 500)
                      : JSON.stringify(item.output, null, 2).slice(0, 500)}
                  </pre>
                )}
                {item.input != null && item.output == null && (
                  <pre className="text-xs text-[#6a6560] overflow-x-auto max-h-24 overflow-y-auto">
                    {typeof item.input === "string"
                      ? String(item.input).slice(0, 300)
                      : JSON.stringify(item.input, null, 2).slice(0, 300)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {activePanel === "artifacts" && (
          <div className="space-y-3">
            {thinkingActive && (
              <div className="flex items-center gap-2 text-sm text-[var(--link)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            {thinkingContent ? (
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                <pre className="text-sm text-[#c8c4bd] whitespace-pre-wrap break-words">
                  {thinkingContent}
                </pre>
              </div>
            ) : (
              !thinkingActive && (
                <div className="text-sm text-[#6a6560] text-center py-8">
                  No thinking content yet
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
