// CRITICAL
"use client";

import { memo, useMemo } from "react";
import { Terminal, FileText, Globe, Search, ListChecks, PenLine, Check, ChevronRight, Loader2 } from "lucide-react";
import type { ChatMessagePart } from "@/lib/types";
import { categorize, cleanToolName, extractTarget, formatToolDisplayName } from "@/app/chat/hooks/chat/use-current-tool-call";

type ToolPart = ChatMessagePart & { toolCallId: string; toolName?: string; input?: unknown; state?: string; output?: unknown };

interface ToolCallRowProps {
  part: ToolPart;
  isExecuting: boolean;
  hasResult: boolean;
  isError: boolean;
}

const ICONS: Record<string, typeof Terminal> = { code: Terminal, file: FileText, edit: PenLine, web: Globe, search: Search, plan: ListChecks };
const COLORS: Record<string, string> = { code: "text-(--hl3)", file: "text-(--hl2)", edit: "text-(--hl2)", web: "text-(--accent)", search: "text-(--hl1)", plan: "text-(--accent)" };

export const ToolCallRow = memo(function ToolCallRow({ part, isExecuting, hasResult, isError }: ToolCallRowProps) {
  const rawName = part.toolName || part.type.replace(/^(tool-|dynamic-tool)/, "");
  const name = useMemo(() => formatToolDisplayName(rawName), [rawName]);
  const cat = useMemo(() => categorize(cleanToolName(rawName)), [rawName]);
  const target = useMemo(() => extractTarget(part.input), [part.input]);
  const Icon = ICONS[cat] ?? Terminal;
  const color = COLORS[cat] ?? "text-(--dim)";
  const label = target ? `${name} — ${target}` : name;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-[5px] rounded-md transition-colors ${isExecuting ? "bg-(--accent)/[0.04]" : "hover:bg-(--fg)/[0.02]"}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 opacity-50 ${color}`} />
      <span className={`text-[12px] flex-1 truncate ${isExecuting ? "text-(--fg)" : "text-(--dim)"}`}>{label}</span>
      {isExecuting ? <Loader2 className="w-3 h-3 text-(--accent) animate-spin shrink-0" />
        : isError ? <span className="w-3 h-3 text-(--err) shrink-0 text-[10px] font-bold">!</span>
        : hasResult ? <Check className="w-3 h-3 text-(--hl2) shrink-0" /> : null}
      <ChevronRight className="w-3 h-3 text-(--dim)/30 shrink-0" />
    </div>
  );
});
