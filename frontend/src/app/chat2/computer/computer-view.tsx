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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-(--border)/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-(--fg)">Agent Computer</span>
          <span className={`h-1.5 w-1.5 rounded-full ${runningCount > 0 ? "bg-(--hl2) animate-pulse" : "bg-(--dim)/20"}`} />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-(--dim)/40 uppercase tracking-wider">
          {runToolCalls.length > 0 && (
            <span>{completedCount}/{runToolCalls.length} done</span>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {currentToolCall ? (
          <ToolRenderer toolCall={currentToolCall} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-10 h-10 rounded-lg bg-(--surface) border border-(--border)/50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-(--dim)/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-[12px] text-(--dim)/40">Waiting for activity...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer — run tool summary */}
      {runToolCalls.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-(--border)/20 bg-(--surface)/30">
          <div className="flex flex-wrap gap-1">
            {runToolCalls.map((tc) => (
              <span
                key={tc.toolCallId}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  tc.state === "running"
                    ? "bg-(--hl2)/10 text-(--hl2)"
                    : tc.state === "error"
                      ? "bg-(--err)/10 text-(--err)"
                      : "bg-(--dim)/5 text-(--dim)/50"
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
