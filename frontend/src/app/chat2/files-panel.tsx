// CRITICAL
"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import type { AgentFileEntry } from "@/lib/types";
import { AgentFileTreeNode, buildAgentFilePath } from "@/app/chat/_components/agent/agent-files-tree";

interface FilesPanelProps {
  sessionId?: string | null;
}

export function FilesPanel({ sessionId }: FilesPanelProps) {
  const [files, setFiles] = useState<AgentFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // Poll agent files
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

  // Read selected file
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
      {/* File tree — single column */}
      <div className="w-40 shrink-0 border-r border-(--border)/20 overflow-y-auto py-1">
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

      {/* File viewer */}
      <div className="flex-1 min-w-0 overflow-auto">
        {fileContent ? (
          <pre className="p-3 text-[12px] font-mono leading-[1.6] text-(--fg) whitespace-pre-wrap break-words">
            {fileContent}
          </pre>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[11px] text-(--dim)">Select a file to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
