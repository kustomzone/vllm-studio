// CRITICAL
"use client";

import { memo, useMemo } from "react";
import { Terminal, Check, Loader2 } from "lucide-react";
import type { ChatMessagePart } from "@/lib/types";
import { categorize, cleanToolName, extractTarget, formatToolDisplayName } from "@/app/chat/hooks/chat/use-current-tool-call";

type ToolPart = ChatMessagePart & { toolCallId: string; toolName?: string; input?: unknown; state?: string; output?: unknown };

interface ToolCallRowProps {
  part: ToolPart;
  isExecuting: boolean;
  hasResult: boolean;
  isError: boolean;
}

export const ToolCallRow = memo(function ToolCallRow({ part, isExecuting, hasResult, isError }: ToolCallRowProps) {
  const rawName = part.toolName || part.type.replace(/^(tool-|dynamic-tool)/, "");
  const name = useMemo(() => formatToolDisplayName(rawName), [rawName]);
  const target = useMemo(() => extractTarget(part.input), [part.input]);
  const label = target ? `${name} — ${target}` : name;

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${isExecuting ? "bg-(--fg)/[0.04]" : "hover:bg-(--fg)/[0.02]"}`}>
      <Terminal className="w-3 h-3 shrink-0 text-(--dim)" />
      <span className={`text-[11px] flex-1 truncate ${isExecuting ? "text-(--fg)" : "text-(--dim)"}`}>{label}</span>
      {isExecuting ? <Loader2 className="w-3 h-3 text-(--dim) animate-spin shrink-0" />
        : isError ? <span className="w-3 h-3 text-(--err) shrink-0 text-[10px] font-bold">!</span>
        : hasResult ? <Check className="w-3 h-3 text-(--dim) shrink-0" /> : null}
    </div>
  );
});
