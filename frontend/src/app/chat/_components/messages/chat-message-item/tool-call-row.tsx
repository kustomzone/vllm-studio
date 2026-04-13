// CRITICAL
"use client";

import { memo, useMemo } from "react";
import {
  Terminal,
  FileText,
  Globe,
  Search,
  ListChecks,
  PenLine,
  Check,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { ChatMessagePart } from "@/lib/types";

type ToolPart = ChatMessagePart & {
  toolCallId: string;
  toolName?: string;
  input?: unknown;
  state?: string;
  output?: unknown;
};

interface ToolCallRowProps {
  part: ToolPart;
  isExecuting: boolean;
  hasResult: boolean;
  isError: boolean;
}

const CATEGORY_ICONS: Record<string, typeof Terminal> = {
  code: Terminal,
  file: FileText,
  edit: PenLine,
  web: Globe,
  search: Search,
  plan: ListChecks,
};

const CATEGORY_CLASSES: Record<string, string> = {
  code: "text-(--hl3)",
  file: "text-(--hl2)",
  edit: "text-(--hl2)",
  web: "text-(--accent)",
  search: "text-(--hl1)",
  plan: "text-(--blue)",
};

function categorize(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("search") || lower.includes("grep") || lower.includes("find")) return "search";
  if (lower.includes("fetch") || lower.includes("browse") || lower.includes("web") || lower.includes("url")) return "web";
  if (lower.includes("plan") || lower.includes("todo")) return "plan";
  if (lower.includes("edit") || lower.includes("write") || lower.includes("create_file")) return "edit";
  if (lower.includes("file") || lower.includes("read") || lower.includes("directory")) return "file";
  if (lower.includes("exec") || lower.includes("run") || lower.includes("shell") || lower.includes("bash") || lower.includes("command")) return "code";
  return "code";
}

function cleanName(raw: string): string {
  const clean = raw.includes("__") ? raw.split("__").slice(1).join("__") : raw;
  return clean
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractTarget(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const obj = input as Record<string, unknown>;
  for (const key of ["path", "filePath", "file", "url", "query", "command", "cmd", "q", "search"]) {
    if (typeof obj[key] === "string" && (obj[key] as string).trim()) return obj[key] as string;
  }
  return null;
}

export const ToolCallRow = memo(function ToolCallRow({
  part,
  isExecuting,
  hasResult,
  isError,
}: ToolCallRowProps) {
  const rawName = part.toolName || part.type.replace(/^(tool-|dynamic-tool)/, "");
  const name = useMemo(() => cleanName(rawName), [rawName]);
  const cat = useMemo(() => categorize(rawName), [rawName]);
  const target = useMemo(() => extractTarget(part.input), [part.input]);
  const Icon = CATEGORY_ICONS[cat] ?? Terminal;
  const colorClass = CATEGORY_CLASSES[cat] ?? "text-(--dim)";

  const label = target ? `${name} — ${target}` : name;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-[5px] rounded-md transition-colors ${
        isExecuting ? "bg-(--accent)/[0.04]" : "hover:bg-(--fg)/[0.02]"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 opacity-50 ${colorClass}`} />
      <span
        className={`text-[12px] flex-1 truncate ${
          isExecuting ? "text-(--fg)" : "text-(--dim)"
        }`}
      >
        {label}
      </span>
      {isExecuting ? (
        <Loader2 className="w-3 h-3 text-(--accent) animate-spin shrink-0" />
      ) : isError ? (
        <span className="w-3 h-3 text-(--err) shrink-0 text-[10px] font-bold">!</span>
      ) : hasResult ? (
        <Check className="w-3 h-3 text-(--hl2) shrink-0" />
      ) : null}
      <ChevronRight className="w-3 h-3 text-(--dim)/30 shrink-0" />
    </div>
  );
});
