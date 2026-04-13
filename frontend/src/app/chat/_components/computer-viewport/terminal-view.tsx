// CRITICAL
"use client";

import { memo, useMemo } from "react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { safeJsonStringify } from "@/lib/safe-json";

function extractCommand(tc: CurrentToolCall): string {
  const inp = tc.input;
  if (typeof inp === "string") return inp;
  if (inp && typeof inp === "object") {
    const o = inp as Record<string, unknown>;
    for (const k of ["command", "cmd", "input", "code", "script"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return tc.target ?? tc.toolName;
}

function fmt(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  return safeJsonStringify(output, "");
}

export const TerminalView = memo(function TerminalView({ toolCall }: { toolCall: CurrentToolCall }) {
  const cmd = useMemo(() => extractCommand(toolCall), [toolCall]);
  const output = useMemo(() => fmt(toolCall.output), [toolCall.output]);
  const running = toolCall.state === "running";
  const error = toolCall.state === "error";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--border)/30 px-4 py-2 shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-(--dim)/50">terminal</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-[1.8] scrollbar-thin">
        <div><span className="text-(--hl2)">$</span> <span className="text-(--fg)">{cmd}</span></div>
        {output && (
          <pre className={`mt-1 whitespace-pre-wrap break-words ${error ? "text-(--err)" : "text-(--dim)/80"}`}>{output}</pre>
        )}
        {running && <div className="mt-1"><span className="inline-block w-[7px] h-[14px] bg-(--fg)/70 animate-[blink_1s_step-end_infinite]" /></div>}
      </div>
    </div>
  );
});
