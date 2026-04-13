// CRITICAL
"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Monitor, Terminal, FileText, Globe, Search, ListChecks, PenLine } from "lucide-react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { TerminalView } from "./terminal-view";
import { FileView } from "./file-view";
import { BrowserView } from "./browser-view";
import { TodoView } from "./todo-view";

type ViewType = "terminal" | "file" | "browser" | "todo" | "idle";

function resolveViewType(tc: CurrentToolCall | null): ViewType {
  if (!tc) return "idle";
  switch (tc.category) {
    case "code":
      return "terminal";
    case "file":
    case "edit":
      return "file";
    case "web":
    case "search":
      return "browser";
    case "plan":
      return "todo";
    default:
      // Fallback: try to guess from tool name
      if (tc.toolName.toLowerCase().includes("exec") || tc.toolName.toLowerCase().includes("command")) return "terminal";
      if (tc.toolName.toLowerCase().includes("file") || tc.toolName.toLowerCase().includes("read")) return "file";
      return "terminal";
  }
}

const VIEW_ICON: Record<string, typeof Terminal> = {
  code: Terminal,
  file: FileText,
  edit: PenLine,
  web: Globe,
  search: Search,
  plan: ListChecks,
  other: Terminal,
};

export interface ComputerViewportProps {
  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];
  isLoading: boolean;
  runStatusLine?: string;
}

export const ComputerViewport = memo(function ComputerViewport({
  currentToolCall,
  runToolCalls,
  isLoading,
  runStatusLine,
}: ComputerViewportProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // If user clicked a tab, show that tool call; otherwise show the current one
  const displayedToolCall = useMemo(() => {
    if (focusedId) {
      const found = runToolCalls.find((tc) => tc.toolCallId === focusedId);
      if (found) return found;
    }
    return currentToolCall;
  }, [focusedId, currentToolCall, runToolCalls]);

  // Reset focus when current tool changes to a new running one
  const currentRunningId = currentToolCall?.state === "running" ? currentToolCall.toolCallId : null;
  useMemo(() => {
    if (currentRunningId) setFocusedId(null);
  }, [currentRunningId]);

  const viewType = resolveViewType(displayedToolCall);

  const handleTabClick = useCallback((id: string) => {
    setFocusedId((prev) => (prev === id ? null : id));
  }, []);

  // Status
  const statusDot = isLoading
    ? currentToolCall?.state === "running"
      ? "bg-(--accent) animate-[status-pulse_1s_ease-in-out_infinite]"
      : "bg-(--hl2) animate-[status-pulse_2s_ease-in-out_infinite]"
    : "bg-(--dim)/40";

  const statusLabel = isLoading
    ? runStatusLine || "Working..."
    : "Idle";

  // Breadcrumb
  const breadcrumb = displayedToolCall?.target
    ? displayedToolCall.target.length > 60
      ? `...${displayedToolCall.target.slice(-57)}`
      : displayedToolCall.target
    : "";

  return (
    <div className="flex flex-1 flex-col bg-(--bg) min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-(--border)/40 shrink-0 bg-(--bg)">
        <div className="w-5 h-5 rounded-[5px] bg-(--surface) border border-(--border) flex items-center justify-center shrink-0">
          <Monitor className="w-3 h-3 text-(--fg)/60" />
        </div>
        <span className="text-[13px] font-semibold text-(--fg)">Agent&apos;s Computer</span>
        <div className="flex items-center gap-1.5 ml-2">
          <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${statusDot}`} />
          <span className="text-[10px] font-mono text-(--dim) truncate max-w-[200px]">
            {statusLabel}
          </span>
        </div>
        {breadcrumb && (
          <div className="ml-auto flex items-center gap-1 font-mono text-[10px] text-(--dim)/50">
            <span className="opacity-40">&rsaquo;</span>
            <span className="truncate max-w-[250px]">{breadcrumb}</span>
          </div>
        )}
      </div>

      {/* Action tab bar */}
      {runToolCalls.length > 0 && (
        <div className="flex items-center gap-1 px-4 border-b border-(--border)/40 bg-(--bg) shrink-0 overflow-x-auto scrollbar-hide min-h-[34px]">
          {runToolCalls.map((tc) => {
            const Icon = VIEW_ICON[tc.category] ?? Terminal;
            const isActive = (focusedId === tc.toolCallId) ||
              (!focusedId && tc.toolCallId === currentToolCall?.toolCallId);
            const isRunning = tc.state === "running";
            const label = tc.toolName
              .replace(/_/g, " ")
              .replace(/([a-z])([A-Z])/g, "$1 $2")
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" ");

            return (
              <button
                key={tc.toolCallId}
                onClick={() => handleTabClick(tc.toolCallId)}
                className={`flex items-center gap-1.5 px-2.5 py-[7px] text-[11px] whitespace-nowrap shrink-0 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "text-(--fg) border-(--accent)"
                    : "text-(--dim) border-transparent hover:text-(--fg)"
                }`}
              >
                {isRunning ? (
                  <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-transparent border-t-(--accent) animate-spin shrink-0" />
                ) : (
                  <Icon className="w-3 h-3 opacity-50 shrink-0" />
                )}
                <span className="max-w-[120px] truncate">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Viewport */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewType === "terminal" && displayedToolCall && <TerminalView toolCall={displayedToolCall} />}
        {viewType === "file" && displayedToolCall && <FileView toolCall={displayedToolCall} />}
        {viewType === "browser" && displayedToolCall && <BrowserView toolCall={displayedToolCall} />}
        {viewType === "todo" && displayedToolCall && <TodoView toolCall={displayedToolCall} />}
        {viewType === "idle" && <IdleView />}
      </div>
    </div>
  );
});

function IdleView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 opacity-15">
      <Monitor className="w-8 h-8 text-(--dim)" strokeWidth={1.5} />
      <p className="font-mono text-[11px] text-(--dim)">Waiting for activity...</p>
    </div>
  );
}
