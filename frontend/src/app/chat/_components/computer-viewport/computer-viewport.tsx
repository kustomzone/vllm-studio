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
  hasSession?: boolean;
}

export const ComputerViewport = memo(function ComputerViewport({
  currentToolCall,
  runToolCalls,
  isLoading,
  runStatusLine,
  activityGroups,
  agentFiles,
  selectedFilePath,
  selectedFileContent,
  selectedFileLoading,
  onSelectFile,
  hasSession,
}: ComputerViewportProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [subView, setSubView] = useState<"tools" | "files">("tools");

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

  const breadcrumb = displayed?.target
    ? displayed.target.length > 60
      ? `...${displayed.target.slice(-57)}`
      : displayed.target
    : "";

  const fileCount = agentFiles?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-(--bg) min-w-0 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-(--border)/40 shrink-0">
        <div className="w-5 h-5 rounded-[5px] bg-(--surface) border border-(--border) flex items-center justify-center shrink-0">
          <Monitor className="w-3 h-3 text-(--fg)/60" />
        </div>
        <span className="text-[13px] font-semibold text-(--fg)">Agent&apos;s Computer</span>
        <div className="flex items-center gap-1.5 ml-2">
          <div
            className={`w-[5px] h-[5px] rounded-full shrink-0 ${
              isLoading
                ? runningId
                  ? "bg-(--accent) animate-pulse"
                  : "bg-(--hl2) animate-pulse-soft"
                : "bg-(--dim)/40"
            }`}
          />
          <span className="text-[10px] font-mono text-(--dim) truncate max-w-[200px]">
            {isLoading ? runStatusLine || "Working..." : "Idle"}
          </span>
        </div>
        {breadcrumb && subView === "tools" && (
          <div className="ml-auto font-mono text-[10px] text-(--dim)/50 truncate max-w-[250px]">
            <span className="opacity-40 mr-1">&rsaquo;</span>
            {breadcrumb}
          </div>
        )}
      </div>

      {/* Sub-view toggle: Tools / Files */}
      <div className="flex items-center border-b border-(--border)/40 shrink-0">
        <div className="flex items-center gap-0 px-2">
          <button
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
        </div>

        {/* Tool call tabs (only in tools sub-view) */}
        {subView === "tools" && runToolCalls.length > 0 && (
          <div className="flex items-center gap-1 ml-1 overflow-x-auto scrollbar-hide">
            <div className="w-px h-4 bg-(--border)/30 mx-1" />
            {runToolCalls.map((tc) => {
              const Icon = CAT_ICON[tc.category] ?? Terminal;
              const active =
                focusedId === tc.toolCallId ||
                (!focusedId && tc.toolCallId === currentToolCall?.toolCallId);
              const spinning = tc.state === "running";
              return (
                <button
                  key={tc.toolCallId}
                  onClick={() => handleTab(tc.toolCallId)}
                  className={`flex items-center gap-1.5 px-2 py-[7px] text-[10px] whitespace-nowrap shrink-0 border-b-2 transition-all cursor-pointer ${
                    active
                      ? "text-(--fg) border-(--accent)"
                      : "text-(--dim) border-transparent hover:text-(--fg)"
                  }`}
                >
                  {spinning ? (
                    <Loader2 className="w-2.5 h-2.5 text-(--accent) animate-spin shrink-0" />
                  ) : (
                    <Icon className="w-3 h-3 opacity-50 shrink-0" />
                  )}
                  <span className="max-w-[100px] truncate">
                    {formatToolDisplayName(tc.toolName)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Viewport */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {subView === "tools" && (
          <>
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
          </>
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
              onClick={() => onSelectFile?.(active ? null : path)}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-colors ${
                active
                  ? "bg-(--accent)/10 text-(--fg)"
                  : "text-(--dim) hover:bg-(--fg)/[0.03] hover:text-(--fg)"
              }`}
            >
              <FileText className="w-3 h-3 opacity-50 shrink-0" />
              <span className="text-[11px] font-mono truncate">{path}</span>
            </button>
          );
        })}
      </div>
      {/* File content */}
      {selectedFilePath && (
        <div className="flex-1 overflow-y-auto font-mono text-[12px] leading-[1.8] scrollbar-thin">
          {selectedFileLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-4 h-4 text-(--dim) animate-spin" />
            </div>
          ) : selectedFileContent ? (
            selectedFileContent.split("\n").map((line, i) => (
              <div key={i} className="flex min-h-[21px] hover:bg-(--fg)/[0.015]">
                <span className="w-12 text-right pr-4 text-(--dim)/25 select-none shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 whitespace-pre pr-4 text-(--fg)/85">{line}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-[11px] font-mono text-(--dim)/30">no content</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
