// CRITICAL
"use client";

import { memo, useMemo } from "react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { safeJsonStringify } from "@/lib/safe-json";

function extractPath(tc: CurrentToolCall): string {
  const inp = tc.input;
  if (inp && typeof inp === "object") {
    const o = inp as Record<string, unknown>;
    for (const k of ["path", "filePath", "file", "filename", "file_path", "target"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return tc.target ?? "file";
}

function extractContent(tc: CurrentToolCall): string {
  if (tc.output != null) {
    if (typeof tc.output === "string") return tc.output;
    return safeJsonStringify(tc.output, "");
  }
  if (tc.input && typeof tc.input === "object") {
    const o = tc.input as Record<string, unknown>;
    for (const k of ["content", "text", "new_str", "old_str"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return "";
}

function resolveAction(tc: CurrentToolCall): "read" | "write" | "edit" {
  const n = tc.toolName.toLowerCase();
  if (n.includes("edit") || n.includes("update") || n.includes("patch")) return "edit";
  if (n.includes("write") || n.includes("create") || n.includes("save")) return "write";
  return "read";
}

const BADGE: Record<string, { label: string; cls: string }> = {
  read: { label: "Reading", cls: "bg-(--accent)/10 text-(--accent) border border-(--accent)/15" },
  write: { label: "Creating", cls: "bg-(--hl2)/10 text-(--hl2) border border-(--hl2)/15" },
  edit: { label: "Editing", cls: "bg-(--accent)/10 text-(--accent) border border-(--accent)/15" },
};

export const FileView = memo(function FileView({ toolCall }: { toolCall: CurrentToolCall }) {
  const path = useMemo(() => extractPath(toolCall), [toolCall]);
  const content = useMemo(() => extractContent(toolCall), [toolCall]);
  const action = useMemo(() => resolveAction(toolCall), [toolCall]);
  const badge = BADGE[action];
  const running = toolCall.state === "running";
  const isWrite = action !== "read";
  const lines = useMemo(() => (content ? content.split("\n") : []), [content]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--border)/30 px-4 py-2 shrink-0">
        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        <span className="text-[11px] font-mono text-(--dim)/70 truncate">{path}</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[12px] leading-[1.8] scrollbar-thin">
        {lines.length > 0 ? lines.map((line, i) => (
          <div key={i} className={`flex min-h-[21px] hover:bg-(--fg)/[0.015] ${isWrite ? "bg-(--hl2)/[0.04]" : ""}`}>
            <span className="w-12 text-right pr-4 text-(--dim)/25 select-none shrink-0">{i + 1}</span>
            <span className={`flex-1 whitespace-pre pr-4 ${isWrite ? "text-(--hl2)/90" : "text-(--fg)/85"}`}>
              {line}
              {running && i === lines.length - 1 && <span className="inline-block w-px h-[14px] bg-(--accent) animate-[blink_1s_step-end_infinite] align-middle ml-px" />}
            </span>
          </div>
        )) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] font-mono text-(--dim)/30">{running ? "reading..." : "no content"}</span>
          </div>
        )}
      </div>
    </div>
  );
});
