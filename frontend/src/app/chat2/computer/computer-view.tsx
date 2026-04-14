// CRITICAL
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { extractTarget } from "@/app/chat/hooks/chat/use-current-tool-call";
import { ToolRenderer } from "./tool-renderer";
import api from "@/lib/api";
import type { AgentFileEntry } from "@/lib/types";
import { AgentFileTreeNode, buildAgentFilePath } from "@/app/chat/_components/agent/agent-files-tree";

type SubPanel = "browser" | "preview" | "files";

interface ComputerViewProps {
  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];
  isLoading: boolean;
  sessionId?: string | null;
}

export function ComputerView({ currentToolCall, runToolCalls, isLoading, sessionId }: ComputerViewProps) {
  const [subPanel, setSubPanel] = useState<SubPanel>("browser");
  const runningCount = runToolCalls.filter((t) => t.state === "running").length;

  // Extract browser URL from the latest web tool call
  const browserUrl = useMemo(() => {
    // Check current tool call first
    if (currentToolCall?.category === "web" && currentToolCall.target) {
      return currentToolCall.target;
    }
    // Then check recent run tool calls in reverse
    for (let i = runToolCalls.length - 1; i >= 0; i--) {
      const tc = runToolCalls[i];
      if (tc.category === "web" && tc.target) {
        return tc.target;
      }
    }
    return null;
  }, [currentToolCall, runToolCalls]);

  // Auto-switch to preview when there's a non-web tool running
  const hasToolPreview = currentToolCall != null && currentToolCall.category !== "web";

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="px-2 py-1.5 flex items-center gap-1 shrink-0 border-b border-(--border)/20">
        <TabBtn active={subPanel === "browser"} onClick={() => setSubPanel("browser")}>
          Browser
        </TabBtn>
        <TabBtn active={subPanel === "preview"} onClick={() => setSubPanel("preview")}>
          Preview
        </TabBtn>
        <TabBtn active={subPanel === "files"} onClick={() => setSubPanel("files")}>
          Files
        </TabBtn>
        <div className="flex-1" />
        {runningCount > 0 && (
          <span className="h-1.5 w-1.5 rounded-full bg-(--hl2) animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {subPanel === "browser" && (
          <BrowserPanel url={browserUrl} isLoading={isLoading} />
        )}
        {subPanel === "preview" && (
          <PreviewPanel currentToolCall={currentToolCall} />
        )}
        {subPanel === "files" && (
          <FilesStub sessionId={sessionId} />
        )}
      </div>

      {/* Tool run strip — always visible */}
      {runToolCalls.length > 0 && (
        <div className="shrink-0 px-3 py-1.5 border-t border-(--border)/20">
          <div className="flex flex-wrap gap-1">
            {runToolCalls.slice(-8).map((tc) => (
              <button
                key={tc.toolCallId}
                onClick={() => {
                  if (tc.category === "web") setSubPanel("browser");
                  else setSubPanel("preview");
                }}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                  tc.state === "running"
                    ? "bg-(--hl2)/10 text-(--hl2)"
                    : tc.state === "error"
                      ? "bg-(--err)/10 text-(--err)"
                      : "bg-(--fg)/5 text-(--dim) hover:bg-(--fg)/10"
                }`}
              >
                {tc.toolName.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Browser Panel ── */
function BrowserPanel({ url, isLoading }: { url: string | null; isLoading: boolean }) {
  const [manualUrl, setManualUrl] = useState("");
  const [goUrl, setGoUrl] = useState<string | null>(null);

  const activeUrl = url || goUrl;

  const handleNavigate = () => {
    const u = manualUrl.trim();
    if (!u) return;
    setGoUrl(u.startsWith("http") ? u : `https://${u}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="px-3 py-1.5 flex items-center gap-2 shrink-0">
        <div className="flex-1 flex items-center bg-(--surface) rounded-md px-2 py-1 gap-1.5">
          <span className="text-[10px] text-(--dim)">↗</span>
          <input
            type="text"
            value={activeUrl ?? manualUrl}
            onChange={(e) => { setManualUrl(e.target.value); setGoUrl(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
            placeholder="Enter URL..."
            className="flex-1 bg-transparent text-[11px] font-mono text-(--fg) placeholder:text-(--dim)/50 focus:outline-none min-w-0"
          />
        </div>
      </div>

      {/* Browser viewport */}
      <div className="flex-1 min-h-0">
        {activeUrl ? (
          <iframe
            src={activeUrl}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Browser"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 mx-auto mb-2 text-(--dim)/30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <p className="text-xs text-(--dim)">
                {isLoading ? "Opening page..." : "Enter a URL or ask the AI to browse"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Preview Panel ── */
function PreviewPanel({ currentToolCall }: { currentToolCall: CurrentToolCall | null }) {
  if (!currentToolCall) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-(--dim)">No tool output yet</p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-4 min-w-0">
      <ToolRenderer toolCall={currentToolCall} />
    </div>
  );
}

/* ── Files Stub ── */
function FilesStub({ sessionId }: { sessionId?: string | null }) {
  // Lazy import to avoid breaking if FilesPanel isn't ready
  return <FilesPanelLazy sessionId={sessionId} />;
}

function FilesPanelLazy({ sessionId }: { sessionId?: string | null }) {
  const [files, setFiles] = useState<AgentFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { setFiles([]); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await api.getAgentFiles(sessionId);
        if (alive) setFiles(res?.files ?? []);
      } catch {}
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [sessionId]);

  useEffect(() => {
    if (!selectedPath || !sessionId) { setFileContent(null); return; }
    let alive = true;
    (async () => {
      try {
        const res = await api.readAgentFile(sessionId, selectedPath);
        if (alive) setFileContent(res?.content ?? null);
      } catch {
        if (alive) setFileContent(null);
      }
    })();
    return () => { alive = false; };
  }, [selectedPath, sessionId]);

  const onSelect = useCallback((p: string | null) => setSelectedPath(p), []);

  return (
    <div className="flex h-full">
      <div className="w-36 shrink-0 border-r border-(--border)/20 overflow-y-auto py-1">
        {files.length > 0 ? (
          files.map((entry) => (
            <AgentFileTreeNode
              key={buildAgentFilePath(entry, "")}
              entry={entry}
              depth={0}
              fullPath={buildAgentFilePath(entry, "")}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))
        ) : (
          <p className="px-3 py-2 text-[11px] text-(--dim)">No files yet</p>
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-auto">
        {fileContent ? (
          <pre className="p-3 text-[12px] font-mono leading-[1.6] text-(--fg) whitespace-pre-wrap break-words">
            {fileContent}
          </pre>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-(--dim)">Select a file</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tab Button ── */
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
        active ? "bg-(--surface) text-(--fg)" : "text-(--dim) hover:text-(--fg)"
      }`}
    >
      {children}
    </button>
  );
}
