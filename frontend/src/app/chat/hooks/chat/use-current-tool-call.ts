// CRITICAL
"use client";

import { useMemo } from "react";
import type { ChatMessage, ChatMessagePart, ToolResult } from "@/lib/types";

export type ToolCategory = "file" | "search" | "web" | "code" | "plan" | "edit" | "other";

export interface CurrentToolCall {
  toolCallId: string;
  toolName: string;
  category: ToolCategory;
  input?: unknown;
  output?: unknown;
  state: "pending" | "running" | "complete" | "error";
  target?: string;
}

type ToolPart = ChatMessagePart & {
  toolCallId: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
};

const PENDING = new Set(["input-streaming", "input-available", "approval-requested", "approval-responded"]);
const ERROR = new Set(["output-error", "output-denied"]);

function isToolPart(part: ChatMessagePart): part is ToolPart {
  if (typeof part.type !== "string") return false;
  if (part.type === "dynamic-tool") return "toolCallId" in part;
  return part.type.startsWith("tool-") && "toolCallId" in part;
}

export function categorize(name: string): ToolCategory {
  const l = name.toLowerCase();
  if (l.includes("search") || l.includes("grep") || l.includes("find") || l.includes("ripgrep")) return "search";
  if (l.includes("fetch") || l.includes("browse") || l.includes("web") || l.includes("http") || l.includes("url")) return "web";
  if (l.includes("plan") || l.includes("todo")) return "plan";
  if (l.includes("edit") || l.includes("write") || l.includes("create_file") || l.includes("save")) return "edit";
  if (l.includes("file") || l.includes("read") || l.includes("directory") || l.includes("list_files")) return "file";
  if (l.includes("exec") || l.includes("run") || l.includes("shell") || l.includes("bash") || l.includes("command") || l.includes("computer")) return "code";
  return "other";
}

export function extractTarget(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === "string") return input.trim() || undefined;
  if (typeof input !== "object" || Array.isArray(input)) return undefined;
  const o = input as Record<string, unknown>;
  for (const k of ["url", "href", "query", "search", "q", "path", "filePath", "file", "filename", "file_path", "command", "cmd", "input", "name", "from", "to"]) {
    if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
  }
  return undefined;
}

export function cleanToolName(raw: string): string {
  return raw.includes("__") ? raw.split("__").slice(1).join("__") : raw;
}

export function formatToolDisplayName(raw: string): string {
  const clean = cleanToolName(raw);
  return clean
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function resolveState(
  part: ToolPart,
  executingTools: Set<string>,
  toolResultsMap: Map<string, ToolResult>,
): CurrentToolCall["state"] {
  const id = String(part.toolCallId);
  if (executingTools.has(id)) return "running";
  const result = toolResultsMap.get(id);
  if (result) return result.isError ? "error" : "complete";
  const s = part.state;
  if (s && ERROR.has(s)) return "error";
  if (s === "output-available" || s === "result" || part.output != null) return "complete";
  if (s && PENDING.has(s)) return "running";
  return "pending";
}

function buildToolCall(
  part: ToolPart,
  executingTools: Set<string>,
  toolResultsMap: Map<string, ToolResult>,
): CurrentToolCall {
  const rawName = part.toolName || part.type.replace(/^tool-/, "");
  const name = cleanToolName(rawName);
  const state = resolveState(part, executingTools, toolResultsMap);
  const result = toolResultsMap.get(String(part.toolCallId));
  return {
    toolCallId: String(part.toolCallId),
    toolName: name,
    category: categorize(name),
    input: part.input,
    output: result?.content ?? part.output,
    state,
    target: extractTarget(part.input),
  };
}

export interface UseCurrentToolCallOptions {
  messages: ChatMessage[];
  isLoading: boolean;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
}

export function useCurrentToolCall({
  messages,
  executingTools,
  toolResultsMap,
}: UseCurrentToolCallOptions): CurrentToolCall | null {
  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      const parts = msg.parts.filter(isToolPart);
      if (parts.length === 0) continue;
      // Prefer last running tool
      for (let j = parts.length - 1; j >= 0; j--) {
        const s = resolveState(parts[j], executingTools, toolResultsMap);
        if (s === "running") return buildToolCall(parts[j], executingTools, toolResultsMap);
      }
      // Fall back to last tool in latest assistant msg
      return buildToolCall(parts[parts.length - 1], executingTools, toolResultsMap);
    }
    return null;
  }, [messages, executingTools, toolResultsMap]);
}

export function useRunToolCalls({
  messages,
  executingTools,
  toolResultsMap,
}: Omit<UseCurrentToolCallOptions, "isLoading">): CurrentToolCall[] {
  return useMemo(() => {
    const calls: CurrentToolCall[] = [];
    let runStart = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { runStart = i + 1; break; }
    }
    for (let i = runStart; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (!isToolPart(part)) continue;
        calls.push(buildToolCall(part, executingTools, toolResultsMap));
      }
    }
    return calls;
  }, [messages, executingTools, toolResultsMap]);
}
