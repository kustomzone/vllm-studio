// CRITICAL
"use client";

import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { ToolRenderer } from "./tool-renderer";

interface ComputerViewProps {
  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];
  isLoading: boolean;
}

export function ComputerView({ currentToolCall, runToolCalls, isLoading }: ComputerViewProps) {
  const completedCount = runToolCalls.filter((t) => t.state === "complete" || t.state === "error").length;
  const runningCount = runToolCalls.filter((t) => t.state === "running").length;
  const hasContent = currentToolCall != null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${runningCount > 0 ? "bg-(--hl2)" : "bg-(--dim)/40"}`} />
          <span className="text-xs font-medium text-(--fg)">
            {runningCount > 0 ? "Running" : "Computer"}
          </span>
        </div>
        {runToolCalls.length > 0 && (
          <span className="text-[10px] font-mono text-(--dim)">
            {completedCount}/{runToolCalls.length}
          </span>
        )}
      </div>

      {/* Viewport — fixed height container prevents layout shift */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {hasContent ? (
          <div className="p-4 min-w-0">
            <ToolRenderer toolCall={currentToolCall!} />
          </div>
        ) : (
          /* Empty state — computer desktop with smiley */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              {/* Retro computer icon */}
              <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto mb-3 text-(--dim)/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {/* Monitor */}
                <rect x="8" y="6" width="48" height="34" rx="4" />
                {/* Screen with smiley */}
                <rect x="12" y="10" width="40" height="26" rx="2" fill="currentColor" opacity="0.1" stroke="none" />
                {/* Smiley face */}
                <circle cx="32" cy="23" r="8" fill="none" strokeWidth="1.5" />
                <circle cx="29" cy="21" r="1" fill="currentColor" stroke="none" />
                <circle cx="35" cy="21" r="1" fill="currentColor" stroke="none" />
                <path d="M28 25.5 Q32 29 36 25.5" fill="none" strokeWidth="1.5" />
                {/* Stand */}
                <line x1="32" y1="40" x2="32" y2="48" />
                <line x1="24" y1="48" x2="40" y2="48" />
                {/* Desk */}
                <rect x="14" y="52" width="36" height="4" rx="2" />
              </svg>
              <p className="text-xs text-(--dim)">Waiting for tools...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer — tool run summary */}
      {runToolCalls.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-(--border)/20">
          <div className="flex flex-wrap gap-1">
            {runToolCalls.map((tc) => (
              <span
                key={tc.toolCallId}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  tc.state === "running"
                    ? "bg-(--hl2)/10 text-(--hl2)"
                    : tc.state === "error"
                      ? "bg-(--err)/10 text-(--err)"
                      : "bg-(--fg)/5 text-(--dim)"
                }`}
              >
                {tc.toolName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
