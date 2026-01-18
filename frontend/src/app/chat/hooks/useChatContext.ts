"use client";

import { useMemo, useCallback } from "react";
import { useContextManager } from "@/hooks/useContextManager";

type ChatRole = "user" | "assistant" | "system";

interface UseChatContextOptions {
  messages: Array<{ role: ChatRole; content: string; id: string }>;
  maxContext: number;
  systemPrompt: string;
  mcpEnabled: boolean;
  mcpTools: unknown[];
  onCompact: (messages: Array<{ role: ChatRole; content: string }>) => void;
}

export function useChatContext({
  messages,
  maxContext,
  systemPrompt,
  mcpEnabled,
  mcpTools,
  onCompact,
}: UseChatContextOptions) {
  const contextMessages = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const handleCompact = useCallback(
    (newMessages: Array<{ role: ChatRole; content: string }>) => {
      onCompact(newMessages);
    },
    [onCompact],
  );

  const contextManager = useContextManager({
    messages: contextMessages,
    maxContext,
    systemPrompt,
    tools: mcpEnabled ? mcpTools : undefined,
    onCompact: handleCompact,
    enabled: true,
  });

  return {
    contextManager,
  };
}
