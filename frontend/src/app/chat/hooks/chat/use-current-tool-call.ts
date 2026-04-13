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
  /** Extracted target (file path, URL, command, etc.) */
  target?: string;
}

type ToolPart = ChatMessagePart & { toolCallId: string; toolName?: string; input?: unknown; output?: unknown; state?: string };

const TOOL_PENDING_STATES = new Set(["input-streaming", "input-available", "approval-requested", "approval-responded"]);
const TOOL_ERROR_STATES = new Set(["output-error", "output-denied"]);

function isToolPart(part: ChatMessagePart): part is ToolPart {
  if (typeof part.type !== "string") return false;
  if (part.type === "dynamic-tool") return "toolCallId" in part;
  return part.type.startsWith("tool-") && "toolCallId" in part;
}

function categorize(toolName: string): ToolCategory {
  const lower = toolName.toLowerCase();

  if (lower.includes("search") || lower.includes("grep") || lower.includes("find") || lower.includes("ripgrep")) return "search";
  if (lower.includes("fetch") || lower.includes("browse") || lower.includes("web") || lower.includes("http") || lower.includes("url")) return "web";
  if (lower.includes("plan") || lower.includes("todo")) return "plan";
  if (lower.includes("edit") || lower.includes("write") || lower.includes("create_file") || lower.includes("save")) return "edit";
  if (lower.includes("file") || lower.includes("read") || lower.includes("directory") || lower.includes("list_files")) return "file";
  if (lower.includes("exec") || lower.includes("run") || lower.includes("shell") || lower.includes("bash") || lower.includes("command") || lower.includes("computer")) return "code";

  return "other";
}

function extractTarget(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === "string") return input.trim() || undefined;
  if (typeof input !== "object" || Array.isArray(input)) return undefined;
  const obj = input as Record<string, unknown>;
  for (const key of ["url", "href", "query", "search", "q", "path", "filePath", "file", "filename", "command", "cmd", "input", "name", "from", "to"]) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}

function cleanToolName(raw: string): string {
  return raw.includes("__") ? raw.split("__").slice(1).join("__") : raw;
}

function resolveState(
  part: ToolPart,
  executingTools: Set<string>,
  toolResultsMap: Map<string, ToolResult>,
): CurrentToolCall["state"] {
  const toolCallId = String(part.toolCallId);
  const isExecuting = executingTools.has(toolCallId);
  const result = toolResultsMap.get(toolCallId);
  const partState = part.state;
  const partHasOutput = part.output != null;

  if (isExecuting) return "running";
  if (result) return result.isError ? "error" : "complete";
  if (partState && TOOL_ERROR_STATES.has(partState)) return "error";
  if (partState === "output-available" || partState === "result" || partHasOutput) return "complete";
  if (partState && TOOL_PENDING_STATES.has(partState)) return "running";
  return "pending";
}

export interface UseCurrentToolCallOptions {
  messages: ChatMessage[];
  isLoading: boolean;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
}

/**
 * Derives the "current" tool call — the one that should be displayed
 * in the Computer Viewport. Returns the last running tool, or the
 * most recently completed one from the latest assistant message.
 */
export function useCurrentToolCall({
  messages,
  isLoading,
  executingTools,
  toolResultsMap,
}: UseCurrentToolCallOptions): CurrentToolCall | null {
  return useMemo(() => {
    // Walk assistant messages backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;

      const toolParts = msg.parts.filter(isToolPart);
      if (toolParts.length === 0) continue;

      // First pass: find a running tool (prefer the last one)
      for (let j = toolParts.length - 1; j >= 0; j--) {
        const part = toolParts[j];
        const state = resolveState(part, executingTools, toolResultsMap);
        if (state === "running") {
          const rawName = part.toolName || part.type.replace(/^tool-/, "");
          const name = cleanToolName(rawName);
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
      }

      // Second pass: return the last completed tool from the latest assistant msg
      for (let j = toolParts.length - 1; j >= 0; j--) {
        const part = toolParts[j];
        const state = resolveState(part, executingTools, toolResultsMap);
        const rawName = part.toolName || part.type.replace(/^tool-/, "");
        const name = cleanToolName(rawName);
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
    }

    return null;
  }, [messages, executingTools, toolResultsMap]);
}

/**
 * Collect all tool calls from the current run (latest user prompt onwards)
 * for the action tab bar in the Computer viewport header.
 */
export function useRunToolCalls({
  messages,
  executingTools,
  toolResultsMap,
}: Omit<UseCurrentToolCallOptions, "isLoading">): CurrentToolCall[] {
  return useMemo(() => {
    const calls: CurrentToolCall[] = [];

    // Find the last user message to scope to current run
    let runStart = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        runStart = i + 1;
        break;
      }
    }

    for (let i = runStart; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (!isToolPart(part)) continue;
        const rawName = part.toolName || part.type.replace(/^tool-/, "");
        const name = cleanToolName(rawName);
        const state = resolveState(part, executingTools, toolResultsMap);
        const result = toolResultsMap.get(String(part.toolCallId));
        calls.push({
          toolCallId: String(part.toolCallId),
          toolName: name,
          category: categorize(name),
          input: part.input,
          output: result?.content ?? part.output,
          state,
          target: extractTarget(part.input),
        });
      }
    }

    return calls;
  }, [messages, executingTools, toolResultsMap]);
}
