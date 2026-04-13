// CRITICAL
"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Monitor, Terminal, FileText, Globe, Search, ListChecks, PenLine, Loader2 } from "lucide-react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { formatToolDisplayName } from "@/app/chat/hooks/chat/use-current-tool-call";
import { TerminalView } from "./terminal-view";
import { FileView } from "./file-view";
import { BrowserView } from "./browser-view";
import { TodoView } from "./todo-view";

type ViewType = "terminal" | "file" | "browser" | "todo" | "idle";

function resolveView(tc: CurrentToolCall | null): ViewType {
  if (!tc) return "idle";
  switch (tc.category) {
    case "code": return "terminal";
    case "file": case "edit": return "file";
    case "web": case "search": return "browser";
    case "plan": return "todo";
    default: return "terminal";
  }
}

const CAT_ICON: Record<string, typeof Terminal> = {
  code: Terminal, file: FileText, edit: PenLine, web: Globe, search: Search, plan: ListChecks, other: Terminal,
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

  const displayed = useMemo(() => {
    if (focusedId) {
      const found = runToolCalls.find(tc => tc.toolCallId === focusedId);
      if (found) return found;
    }
    return currentToolCall;
  }, [focusedId, currentToolCall, runToolCalls]);

  // Auto-clear focus when a new tool starts running
  const runningId = currentToolCall?.state === "running" ? currentToolCall.toolCallId : null;
  useMemo(() => { if (runningId) setFocusedId(null); }, [runningId]);

  const view = resolveView(displayed);
  const handleTab = useCallback((id: string) => setFocusedId(prev => prev === id ? null : id), []);

  const breadcrumb = displayed?.target
    ? (displayed.target.length > 60 ? `...${displayed.target.slice(-57)}` : displayed.target)
    : "";

  return (
    <div className="flex flex-1 flex-col bg-(--bg) min-w-0 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-(--border)/40 shrink-0">
        <div className="w-5 h-5 rounded-[5px] bg-(--surface) border border-(--border) flex items-center justify-center shrink-0">
          <Monitor className="w-3 h-3 text-(--fg)/60" />
        </div>
        <span className="text-[13px] font-semibold text-(--fg)">Agent&apos;s Computer</span>
        <div className="flex items-center gap-1.5 ml-2">
          <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${
            isLoading ? (runningId ? "bg-(--accent) animate-pulse" : "bg-(--hl2) animate-pulse-soft") : "bg-(--dim)/40"
          }`} />
          <span className="text-[10px] font-mono text-(--dim) truncate max-w-[200px]">
            {isLoading ? (runStatusLine || "Working...") : "Idle"}
          </span>
        </div>
        {breadcrumb && (
          <div className="ml-auto font-mono text-[10px] text-(--dim)/50 truncate max-w-[250px]">
            <span className="opacity-40 mr-1">&rsaquo;</span>{breadcrumb}
          </div>
        )}
      </div>

      {/* Action tabs */}
      {runToolCalls.length > 0 && (
        <div className="flex items-center gap-1 px-4 border-b border-(--border)/40 shrink-0 overflow-x-auto scrollbar-hide min-h-[34px]">
          {runToolCalls.map(tc => {
            const Icon = CAT_ICON[tc.category] ?? Terminal;
            const active = (focusedId === tc.toolCallId) || (!focusedId && tc.toolCallId === currentToolCall?.toolCallId);
            const spinning = tc.state === "running";
            return (
              <button key={tc.toolCallId} onClick={() => handleTab(tc.toolCallId)}
                className={`flex items-center gap-1.5 px-2.5 py-[7px] text-[11px] whitespace-nowrap shrink-0 border-b-2 transition-all cursor-pointer ${
                  active ? "text-(--fg) border-(--accent)" : "text-(--dim) border-transparent hover:text-(--fg)"
                }`}>
                {spinning ? <Loader2 className="w-2.5 h-2.5 text-(--accent) animate-spin shrink-0" /> : <Icon className="w-3 h-3 opacity-50 shrink-0" />}
                <span className="max-w-[120px] truncate">{formatToolDisplayName(tc.toolName)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Viewport */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === "terminal" && displayed && <TerminalView toolCall={displayed} />}
        {view === "file" && displayed && <FileView toolCall={displayed} />}
        {view === "browser" && displayed && <BrowserView toolCall={displayed} />}
        {view === "todo" && displayed && <TodoView toolCall={displayed} />}
        {view === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 opacity-15">
            <Monitor className="w-8 h-8 text-(--dim)" strokeWidth={1.5} />
            <p className="font-mono text-[11px] text-(--dim)">Waiting for activity...</p>
          </div>
        )}
      </div>
    </div>
  );
});
