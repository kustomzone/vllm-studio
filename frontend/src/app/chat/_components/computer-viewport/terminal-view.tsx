// CRITICAL
"use client";

import { memo, useMemo } from "react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { safeJsonStringify } from "@/lib/safe-json";

function extractCommand(tc: CurrentToolCall): string {
  const input = tc.input;
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const key of ["command", "cmd", "input", "code", "script"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  return tc.target ?? tc.toolName;
}

function formatOutput(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  return safeJsonStringify(output, "");
}

export const TerminalView = memo(function TerminalView({
  toolCall,
}: {
  toolCall: CurrentToolCall;
}) {
  const command = useMemo(() => extractCommand(toolCall), [toolCall]);
  const output = useMemo(() => formatOutput(toolCall.output), [toolCall.output]);
  const isRunning = toolCall.state === "running";
  const isError = toolCall.state === "error";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--border)/30 px-4 py-2 shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-(--dim)/50">
          terminal
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-[1.8]">
        <div>
          <span className="text-(--hl2)">$</span>{" "}
          <span className="text-(--fg)">{command}</span>
        </div>
        {output && (
          <pre
            className={`mt-1 whitespace-pre-wrap break-words ${
              isError ? "text-(--err)" : "text-(--dim)/80"
            }`}
          >
            {output}
          </pre>
        )}
        {isRunning && (
          <div className="mt-1">
            <span className="inline-block w-[7px] h-[14px] bg-(--fg)/70 animate-[blink_1s_step-end_infinite]" />
          </div>
        )}
      </div>
    </div>
  );
});
