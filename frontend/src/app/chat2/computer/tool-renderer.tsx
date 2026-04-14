"use client";

import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { formatToolDisplayName, extractTarget } from "@/app/chat/hooks/chat/use-current-tool-call";
import { applyDiffHighlights } from "./diff-highlights";
import { Loader2 } from "lucide-react";

interface ToolRendererProps {
  toolCall: CurrentToolCall;
}

export function ToolRenderer({ toolCall }: ToolRendererProps) {
  const displayName = formatToolDisplayName(toolCall.toolName);
  const target = toolCall.target || extractTarget(toolCall.input);
  const isRunning = toolCall.state === "running";
  const isError = toolCall.state === "error";

  const inputStr = formatIo(toolCall.input);
  const outputStr = formatIo(toolCall.output);

  return (
    <div className="p-4">
      {/* Tool badge + target */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
          isRunning ? "bg-(--hl2)/10 text-(--hl2)" : isError ? "bg-(--err)/10 text-(--err)" : "bg-(--dim)/5 text-(--dim)/60"
        }`}>
          {displayName}
        </span>
        {target && (
          <span className="text-[12px] font-mono text-(--dim)/60 truncate">{target}</span>
        )}
        {isRunning && <Loader2 className="w-3 h-3 text-(--hl2) animate-spin shrink-0 ml-auto" />}
      </div>

      {/* Input */}
      {inputStr && (
        <div className="mb-3">
          <span className="text-[9px] font-mono text-(--dim)/30 uppercase tracking-wider">input</span>
          <pre className="mt-1 px-3 py-2 rounded-lg bg-(--surface) border border-(--border)/20 text-[12px] font-mono leading-[1.6] text-(--fg)/80 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words">
            {inputStr}
          </pre>
        </div>
      )}

      {/* Output */}
      {outputStr && (
        <div>
          <span className="text-[9px] font-mono text-(--dim)/30 uppercase tracking-wider">output</span>
          <pre className="mt-1 px-3 py-2 rounded-lg bg-(--surface) border border-(--border)/20 text-[12px] font-mono leading-[1.6] overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words">
            {applyDiffHighlights(outputStr)}
          </pre>
        </div>
      )}

      {/* Running indicator — no output yet */}
      {isRunning && !outputStr && (
        <div className="flex items-center gap-2 text-(--dim)/40">
          <div className="w-1 h-4 bg-(--hl2) animate-pulse rounded-full" />
          <span className="text-[12px] font-mono">running...</span>
        </div>
      )}

      {/* Blinking cursor at end while running */}
      {isRunning && outputStr && (
        <span className="inline-block w-[2px] h-[12px] bg-(--hl2) animate-[blink_1s_step-end_infinite] align-middle ml-0.5 mt-1" />
      )}
    </div>
  );
}

function formatIo(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
