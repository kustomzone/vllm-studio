"use client";

import type { ToolCall, Artifact } from "@/lib/types";
import type { Message } from "../utils";

interface UseChatDerivedOptions {
  messages: Message[];
  isLoading: boolean;
  executingTools: Set<string>;
  researchProgress: unknown;
  sessionArtifacts: Artifact[];
  parseThinking: (content: string) => {
    thinkingContent: string | null;
    isThinkingComplete: boolean;
  };
  extractThinkingBlocks: (content: string) => Array<{ content: string; isComplete: boolean }>;
}

interface ActivityItemThinking {
  type: "thinking";
  id: string;
  content: string;
  isComplete: boolean;
  isStreaming: boolean;
}

interface ActivityItemTool {
  type: "tool";
  id: string;
  toolCall: ToolCall & { messageId: string; model?: string };
}

export type ActivityItem = ActivityItemThinking | ActivityItemTool;

export function useChatDerived({
  messages,
  isLoading,
  executingTools,
  researchProgress,
  sessionArtifacts,
  parseThinking,
  extractThinkingBlocks,
}: UseChatDerivedOptions) {
  const allToolCalls = messages.flatMap((m) =>
    (m.toolCalls || []).map((tc) => ({
      ...tc,
      messageId: m.id,
      model: m.model,
    })),
  );

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

  const lastMessage = messages[messages.length - 1];
  const lastAssistantMessage = lastMessage?.role === "assistant" ? lastMessage : null;

  const thinkingState = (() => {
    if (!latestAssistantMessage?.content) {
      return { content: null as string | null, isComplete: true };
    }
    const { thinkingContent, isThinkingComplete } = parseThinking(latestAssistantMessage.content);
    return { content: thinkingContent, isComplete: isThinkingComplete };
  })();

  const thinkingActive = Boolean(isLoading && thinkingState.content);

  const activityItems: ActivityItem[] = [];
  messages.forEach((msg) => {
    if (msg.role !== "assistant" || !msg.content) return;
    const blocks = extractThinkingBlocks(msg.content);
    const toolCalls = msg.toolCalls || [];
    let toolIndex = 0;

    if (blocks.length === 0 && toolCalls.length === 0) return;

    blocks.forEach((block, idx) => {
      activityItems.push({
        type: "thinking",
        id: `thinking-${msg.id}-${idx}`,
        content: block.content,
        isComplete: block.isComplete,
        isStreaming: Boolean(msg.isStreaming) && !block.isComplete,
      });
      if (toolIndex < toolCalls.length) {
        const toolCall = toolCalls[toolIndex];
        activityItems.push({
          type: "tool",
          id: `tool-${msg.id}-${toolCall.id}`,
          toolCall: { ...toolCall, messageId: msg.id, model: msg.model },
        });
        toolIndex += 1;
      }
    });

    while (toolIndex < toolCalls.length) {
      const toolCall = toolCalls[toolIndex];
      activityItems.push({
        type: "tool",
        id: `tool-${msg.id}-${toolCall.id}`,
        toolCall: { ...toolCall, messageId: msg.id, model: msg.model },
      });
      toolIndex += 1;
    }
  });

  const hasArtifacts = sessionArtifacts.length > 0;
  const hasToolActivity =
    messages.some((m) => m.toolCalls?.length) ||
    executingTools.size > 0 ||
    researchProgress !== null ||
    thinkingActive;
  const hasSidePanelContent = hasToolActivity || hasArtifacts;

  return {
    allToolCalls,
    latestAssistantMessage,
    lastAssistantMessage,
    thinkingState,
    thinkingActive,
    activityItems,
    hasArtifacts,
    hasToolActivity,
    hasSidePanelContent,
  };
}
