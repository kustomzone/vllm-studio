// CRITICAL
"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Monitor,
  Terminal,
  FileText,
  Globe,
  Search,
  ListChecks,
  PenLine,
  Loader2,
  FolderTree,
} from "lucide-react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { formatToolDisplayName } from "@/app/chat/hooks/chat/use-current-tool-call";
import type { AgentFileEntry, AgentFileVersion } from "@/lib/types";
import type { ActivityGroup } from "@/app/chat/types";
import { TerminalView } from "./terminal-view";
import { FileView } from "./file-view";
import { BrowserView } from "./browser-view";
import { TodoView } from "./todo-view";
import { ComputerEmbeddedBrowser } from "./computer-embedded-browser";
import { AgentFilePreview } from "./agent-file-preview";

type ViewType = "terminal" | "file" | "browser" | "todo" | "idle";

function resolveView(tc: CurrentToolCall | null): ViewType {
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
      return "terminal";
  }
}

const CAT_ICON: Record<string, typeof Terminal> = {
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
  activityGroups?: ActivityGroup[];
  agentFiles?: AgentFileEntry[];
  agentFileVersions?: Record<string, AgentFileVersion[]>;
  selectedFilePath?: string | null;
  selectedFileContent?: string | null;
  selectedFileLoading?: boolean;
  onSelectFile?: (path: string | null) => void;
  computerBrowserUrl?: string;
  onComputerBrowserUrlChange?: (url: string) => void;
  hasSession?: boolean;
}

export const ComputerViewport = memo(function ComputerViewport({
  currentToolCall,
  runToolCalls,
  isLoading,
  runStatusLine,
  activityGroups: _activityGroups,
  agentFiles,
  selectedFilePath,
  selectedFileContent,
  selectedFileLoading,
  onSelectFile,
  computerBrowserUrl = "",
  onComputerBrowserUrlChange,
  hasSession,
}: ComputerViewportProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [subView, setSubView] = useState<"tools" | "files" | "browser">("tools");

  const runningId = currentToolCall?.state === "running" ? currentToolCall.toolCallId : null;
  const effectiveFocusedId = runningId ? null : focusedId;

  const displayed = useMemo(() => {
    if (effectiveFocusedId) {
      const found = runToolCalls.find((tc) => tc.toolCallId === effectiveFocusedId);
      if (found) return found;
    }
    return currentToolCall;
  }, [effectiveFocusedId, currentToolCall, runToolCalls]);

  const view = resolveView(displayed);
  const handleTab = useCallback(
    (id: string) => setFocusedId((prev) => (prev === id ? null : id)),
    [],
  );

  const fileCount = agentFiles?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-(--bg) min-w-0 overflow-hidden h-full">
      {/* Top: workspace mode only (tool runs live inside Tools) */}
      <div className="flex shrink-0 border-b border-(--border)/40">
        <div className="flex gap-0 px-2">
          <button
            type="button"
            onClick={() => setSubView("tools")}
            className={`flex items-center gap-1.5 px-2.5 py-[7px] text-[11px] whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              subView === "tools"
                ? "text-(--fg) border-(--accent)"
                : "text-(--dim) border-transparent hover:text-(--fg)"
            }`}
          >
            <Terminal className="w-3 h-3 opacity-50" />
            <span>Tools</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("files")}
            className={`flex items-center gap-1.5 px-2.5 py-[7px] text-[11px] whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              subView === "files"
                ? "text-(--fg) border-(--accent)"
                : "text-(--dim) border-transparent hover:text-(--fg)"
            }`}
          >
            <FolderTree className="w-3 h-3 opacity-50" />
            <span>Files{fileCount > 0 ? ` (${fileCount})` : ""}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("browser")}
            className={`flex items-center gap-1.5 px-2.5 py-[7px] text-[11px] whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              subView === "browser"
                ? "text-(--fg) border-(--accent)"
                : "text-(--dim) border-transparent hover:text-(--fg)"
            }`}
          >
            <Globe className="w-3 h-3 opacity-50" />
            <span>Browser</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {subView === "tools" && (
          <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
            {runToolCalls.length > 0 ? (
              <aside
                className="flex w-[min(11rem,38%)] shrink-0 flex-col border-r border-(--border)/40 bg-(--surface)/35"
                aria-label="Tool runs"
              >
                <div className="border-b border-(--border)/30 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wide text-(--dim)/55">
                  Runs
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto py-1 scrollbar-thin">
                  {runToolCalls.map((tc) => {
                    const Icon = CAT_ICON[tc.category] ?? Terminal;
                    const active =
                      focusedId === tc.toolCallId ||
                      (!focusedId && tc.toolCallId === currentToolCall?.toolCallId);
                    const spinning = tc.state === "running";
                    return (
                      <button
                        type="button"
                        key={tc.toolCallId}
                        onClick={() => handleTab(tc.toolCallId)}
                        className={`flex w-full items-start gap-2 border-l-2 px-2 py-2 text-left text-[11px] transition-colors ${
                          active
                            ? "border-(--accent) bg-(--accent)/8 text-(--fg)"
                            : "border-transparent text-(--dim) hover:bg-(--fg)/[0.04] hover:text-(--fg)"
                        }`}
                      >
                        {spinning ? (
                          <Loader2 className="mt-0.5 h-3 w-3 shrink-0 text-(--accent) animate-spin" />
                        ) : (
                          <Icon className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                        )}
                        <span className="min-w-0 flex-1 break-words leading-snug">
                          {formatToolDisplayName(tc.toolName)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isLoading ? (
                  <div className="shrink-0 border-t border-(--border)/30 px-2 py-1.5 text-[10px] leading-snug text-(--dim)">
                    {runStatusLine?.trim() || "Working…"}
                  </div>
                ) : null}
              </aside>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {view === "terminal" && displayed && <TerminalView toolCall={displayed} />}
              {view === "file" && displayed && <FileView toolCall={displayed} />}
              {view === "browser" && displayed && <BrowserView toolCall={displayed} />}
              {view === "todo" && displayed && <TodoView toolCall={displayed} />}
              {view === "idle" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 opacity-15">
                  <Monitor className="h-8 w-8 text-(--dim)" strokeWidth={1.5} />
                  <p className="font-mono text-[11px] text-(--dim)">Waiting for activity...</p>
                </div>
              )}
            </div>
          </div>
        )}
        {subView === "files" && (
          <ComputerFilesView
            files={agentFiles ?? []}
            selectedFilePath={selectedFilePath ?? null}
            selectedFileContent={selectedFileContent ?? null}
            selectedFileLoading={selectedFileLoading ?? false}
            onSelectFile={onSelectFile}
            hasSession={hasSession ?? false}
          />
        )}
        {subView === "browser" && (
          <ComputerEmbeddedBrowser
            url={computerBrowserUrl}
            onUrlChange={(next) => onComputerBrowserUrlChange?.(next)}
          />
        )}
      </div>
    </div>
  );
});

const ComputerFilesView = memo(function ComputerFilesView({
  files,
  selectedFilePath,
  selectedFileContent,
  selectedFileLoading,
  onSelectFile,
  hasSession,
}: {
  files: AgentFileEntry[];
  selectedFilePath: string | null;
  selectedFileContent: string | null;
  selectedFileLoading: boolean;
  onSelectFile?: (path: string | null) => void;
  hasSession: boolean;
}) {
  if (!hasSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 opacity-15">
        <FolderTree className="w-8 h-8 text-(--dim)" strokeWidth={1.5} />
        <p className="font-mono text-[11px] text-(--dim)">No session</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 opacity-15">
        <FolderTree className="w-8 h-8 text-(--dim)" strokeWidth={1.5} />
        <p className="font-mono text-[11px] text-(--dim)">No files yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* File list */}
      <div
        className={`overflow-y-auto border-b border-(--border)/30 ${
          selectedFilePath ? "max-h-[200px]" : "flex-1"
        }`}
      >
        {files.map((entry) => {
          const path = entry.name;
          const active = selectedFilePath === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => onSelectFile?.(active ? null : path)}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors ${
                active
                  ? "bg-(--accent)/10 text-(--fg)"
                  : "text-(--dim) hover:bg-(--fg)/[0.03] hover:text-(--fg)"
              }`}
            >
              {entry.type === "dir" ? (
                <FolderTree className="h-3 w-3 shrink-0 opacity-50" />
              ) : (
                <FileText className="h-3 w-3 shrink-0 opacity-50" />
              )}
              <span className="text-[11px] font-mono truncate">{path}</span>
            </button>
          );
        })}
      </div>
      {/* File content */}
      {selectedFilePath && (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
          <AgentFilePreview
            path={selectedFilePath}
            content={selectedFileContent}
            loading={selectedFileLoading}
          />
        </div>
      )}
    </div>
  );
});
