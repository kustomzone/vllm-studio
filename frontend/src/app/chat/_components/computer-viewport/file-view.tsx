// CRITICAL
"use client";

import { memo, useMemo } from "react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { safeJsonStringify } from "@/lib/safe-json";

function extractFilePath(tc: CurrentToolCall): string {
  const input = tc.input;
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const key of ["path", "filePath", "file", "filename", "file_path", "target"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  return tc.target ?? "file";
}

function extractFileContent(tc: CurrentToolCall): string {
  if (tc.output != null) {
    if (typeof tc.output === "string") return tc.output;
    return safeJsonStringify(tc.output, "");
  }
  if (tc.input && typeof tc.input === "object") {
    const obj = tc.input as Record<string, unknown>;
    for (const key of ["content", "text", "new_str", "old_str"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  return "";
}

function resolveAction(tc: CurrentToolCall): "read" | "write" | "edit" {
  const name = tc.toolName.toLowerCase();
  if (name.includes("edit") || name.includes("update") || name.includes("patch")) return "edit";
  if (name.includes("write") || name.includes("create") || name.includes("save")) return "write";
  return "read";
}

const ACTION_CONFIG = {
  read: { label: "Reading", cls: "bg-(--blue)/10 text-(--blue) border border-(--blue)/15" },
  write: { label: "Creating", cls: "bg-(--hl2)/10 text-(--hl2) border border-(--hl2)/15" },
  edit: { label: "Editing", cls: "bg-(--accent)/10 text-(--accent) border border-(--accent)/15" },
} as const;

export const FileView = memo(function FileView({
  toolCall,
}: {
  toolCall: CurrentToolCall;
}) {
  const filePath = useMemo(() => extractFilePath(toolCall), [toolCall]);
  const content = useMemo(() => extractFileContent(toolCall), [toolCall]);
  const action = useMemo(() => resolveAction(toolCall), [toolCall]);
  const config = ACTION_CONFIG[action];
  const isRunning = toolCall.state === "running";

  const lines = useMemo(() => {
    if (!content) return [];
    return content.split("\n");
  }, [content]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--border)/30 px-4 py-2 shrink-0">
        <span
          className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${config.cls}`}
        >
          {config.label}
        </span>
        <span className="text-[11px] font-mono text-(--dim)/70 truncate">{filePath}</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[12px] leading-[1.8]">
        {lines.length > 0 ? (
          lines.map((line, i) => {
            const isWriteLine = action !== "read";
            return (
              <div
                key={i}
                className={`flex min-h-[21px] hover:bg-(--fg)/[0.015] ${
                  isWriteLine ? "bg-(--hl2)/[0.04]" : ""
                }`}
              >
                <span className="w-12 text-right pr-4 text-(--dim)/25 select-none shrink-0">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 whitespace-pre pr-4 ${
                    isWriteLine ? "text-(--hl2)/90" : "text-(--fg)/85"
                  }`}
                >
                  {line}
                  {isRunning && i === lines.length - 1 && (
                    <span className="inline-block w-px h-[14px] bg-(--accent) animate-[blink_1s_step-end_infinite] align-middle ml-px" />
                  )}
                </span>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] font-mono text-(--dim)/30">
              {isRunning ? "reading..." : "no content"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
