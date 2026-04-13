// CRITICAL
"use client";

import type { Artifact, ChatMessage } from "@/lib/types";
import { isToolCallOnlyText } from "@/app/chat/hooks/chat/use-chat-message-mapping/helpers";

function isToolOnlyMessage(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;

  let hasToolParts = false;
  for (const part of message.parts) {
    if (part.type === "text") {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        if (isToolCallOnlyText(text)) return false;
        if (text.trim().length > 0) return false;
      }
      continue;
    }
    if (part.type === "dynamic-tool") {
      hasToolParts = true;
      continue;
    }
    if (
      typeof part.type === "string" &&
      (part.type.startsWith("tool-") || part.type === "tool-call")
    ) {
      hasToolParts = true;
    }
  }

  return hasToolParts;
}

export function hasNonEmptyText(message: ChatMessage): boolean {
  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const type = (part as { type?: unknown }).type;
    if (type !== "text") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && !isToolCallOnlyText(text) && text.trim().length > 0)
      return true;
  }
  return false;
}

export function filterVisibleMessages({
  messages,
  isLoading,
  lastRawMessageId,
  artifactsByMessage,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  lastRawMessageId: string | undefined;
  artifactsByMessage?: Map<string, Artifact[]>;
}) {
  // During loading: find where the current agent run starts (first message after last user msg).
  // We only want to show the single live streaming message, not every intermediate turn.
  let currentRunStart = -1;
  if (isLoading) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        currentRunStart = i + 1;
        break;
      }
    }
  }

  return messages.filter((m, idx) => {
    const metadata = m.metadata as { internal?: boolean } | undefined;
    if (metadata?.internal) return false;

    if (m.role !== "assistant") return true;

    // During loading: hide every current-run assistant message except the live streaming one.
    // This prevents intermediate tool-call turns from adding and removing height in the chat.
    if (currentRunStart >= 0 && idx >= currentRunStart) {
      if (m.id !== lastRawMessageId) return false;
      // Also hide the streaming message itself if it has no text yet (tool call in flight) —
      // the footer typing indicator handles that state.
      return hasNonEmptyText(m);
    }

    // Completed messages: standard filtering.
    if (isToolOnlyMessage(m)) return false;
    const hasArtifacts = Boolean(artifactsByMessage?.get(m.id)?.length);
    if (!hasArtifacts && !hasNonEmptyText(m)) return false;
    return true;
  });
}
