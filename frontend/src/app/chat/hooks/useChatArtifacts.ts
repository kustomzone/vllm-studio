"use client";

import { useMemo } from "react";
import type { Artifact } from "@/lib/types";
import type { Message } from "../utils";
import type { IMessageParsingService } from "@/lib/services/message-parsing";

interface UseChatArtifactsOptions {
  artifactsEnabled: boolean;
  currentSessionId: string | null;
  messages: Message[];
  parsing: Pick<IMessageParsingService, "parseArtifacts">;
}

export function useChatArtifacts({
  artifactsEnabled,
  currentSessionId,
  messages,
  parsing,
}: UseChatArtifactsOptions) {
  const sessionArtifacts = useMemo(() => {
    if (!artifactsEnabled || !messages.length) return [];
    const artifacts: Artifact[] = [];
    messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.content && !msg.isStreaming) {
        const { artifacts: extracted } = parsing.parseArtifacts(msg.content);
        extracted.forEach((artifact) =>
          artifacts.push({
            ...artifact,
            message_id: msg.id,
            session_id: currentSessionId || undefined,
          }),
        );
      }
    });
    return artifacts;
  }, [artifactsEnabled, currentSessionId, messages, parsing]);

  return {
    sessionArtifacts,
  };
}
