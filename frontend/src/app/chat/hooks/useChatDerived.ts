"use client";

import { useMemo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { ActivityItem, ThinkingState } from "../types";
import type { ToolResult } from "@/lib/types";
import { thinkingParser } from "@/lib/services/message-parsing";

interface UseChatDerivedOptions {
  messages: UIMessage[];
  isLoading: boolean;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
}

export function useChatDerived({
  messages,
  isLoading,
  executingTools,
  toolResultsMap,
}: UseChatDerivedOptions) {
  // Extract thinking/reasoning content from the last assistant message
  // Combines both AI SDK reasoning parts AND <think>/<thinking> tags from text content
  const thinkingState = useMemo<ThinkingState>(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return { content: "", isComplete: true };

    // 1. Extract AI SDK reasoning parts
    const reasoningParts = lastAssistant.parts.filter(
      (part): part is { type: "reasoning"; text: string } => part.type === "reasoning",
    );
    const aiSdkReasoning = reasoningParts.map((p) => p.text).filter(Boolean).join("\n");

    // 2. Extract <think>/<thinking> tags from text content
    const textContent = lastAssistant.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    const parsed = thinkingParser.parse(textContent);
    const thinkTagContent = parsed.thinkingContent || "";

    // 3. Combine both sources
    const combined = [aiSdkReasoning, thinkTagContent].filter(Boolean).join("\n\n");

    return {
      content: combined,
      isComplete: !isLoading && parsed.isThinkingComplete,
    };
  }, [messages, isLoading]);

  const thinkingActive = isLoading && thinkingState.content.length > 0;

  const isToolPart = (
    part: UIMessage["parts"][number],
  ): part is UIMessage["parts"][number] & { toolCallId: string; input?: unknown } => {
    if (typeof part.type !== "string") return false;
    if (part.type === "dynamic-tool") return "toolCallId" in part;
    return part.type.startsWith("tool-") && "toolCallId" in part;
  };

  // Build activity items from tool calls across all messages
  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    let idCounter = 0;

    messages.forEach((msg) => {
      if (msg.role !== "assistant") return;

      msg.parts.forEach((part) => {
        if (!isToolPart(part)) return;

        const toolCallId = String(part.toolCallId);
        const result = toolResultsMap.get(toolCallId);
        const isExecuting = executingTools.has(toolCallId);

        const toolName =
          part.type === "dynamic-tool"
            ? "toolName" in part
              ? String(part.toolName)
              : "tool"
            : part.type.replace(/^tool-/, "");

        items.push({
          id: `activity-${idCounter++}`,
          type: "tool-call",
          timestamp: Date.now(),
          toolName,
          toolCallId,
          state: isExecuting
            ? "running"
            : result
              ? result.isError
                ? "error"
                : "complete"
              : "pending",
          input: "input" in part ? part.input : undefined,
          output: result?.content,
        });
      });
    });

    return items;
  }, [messages, executingTools, toolResultsMap]);

  const hasToolActivity = activityItems.length > 0 || executingTools.size > 0;

  const hasSidePanelContent = hasToolActivity || thinkingState.content.length > 0;

  // Last assistant message for actions
  const lastAssistantMessage = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === "assistant") || null;
  }, [messages]);

  return {
    thinkingState,
    thinkingActive,
    activityItems,
    hasToolActivity,
    hasSidePanelContent,
    lastAssistantMessage,
  };
}
