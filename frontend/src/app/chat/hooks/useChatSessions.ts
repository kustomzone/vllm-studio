"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatSession } from "../types";
import type { StoredMessage } from "@/lib/types";
import type { UIMessage } from "@ai-sdk/react";
import type { LanguageModelUsage } from "ai";

/**
 * Convert stored messages from backend to UIMessage format for AI SDK
 * Note: We only restore text content for simplicity - tool calls would need
 * complex state reconstruction that's not worth the effort for history display
 */
function convertStoredToUIMessages(storedMessages: StoredMessage[]): UIMessage[] {
  return storedMessages.map((msg) => {
    const parts: UIMessage["parts"] = [];

    // Add text content part
    if (msg.content) {
      parts.push({ type: "text", text: msg.content });
    }

    // For tool calls, just add a text summary instead of reconstructing complex tool parts
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolSummary = msg.tool_calls
        .map((tc) => {
          const hasResult = tc.result !== undefined && tc.result !== null;
          return `[Tool: ${tc.function.name}${hasResult ? " (completed)" : ""}]`;
        })
        .join("\n");
      if (toolSummary && !msg.content?.includes("[Tool:")) {
        parts.push({ type: "text", text: toolSummary });
      }
    }

    const inputTokens = msg.request_total_input_tokens ?? msg.prompt_tokens ?? undefined;
    const outputTokens = msg.request_completion_tokens ?? msg.completion_tokens ?? undefined;
    const totalTokens =
      msg.total_tokens ??
      (inputTokens != null || outputTokens != null
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined);

    const usage: LanguageModelUsage | undefined =
      inputTokens != null || outputTokens != null || totalTokens != null
        ? {
            inputTokens,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokens,
            outputTokenDetails: {
              textTokens: undefined,
              reasoningTokens: undefined,
            },
            totalTokens,
          }
        : undefined;

    const metadata =
      msg.model || usage
        ? {
            model: msg.model,
            usage,
          }
        : undefined;

    return {
      id: msg.id,
      role: msg.role,
      parts,
      metadata,
    };
  });
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>("New Chat");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const activeSessionRef = useRef<string | null>(null);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await api.getChatSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string): Promise<UIMessage[] | null> => {
    if (activeSessionRef.current === sessionId) return null;
    activeSessionRef.current = sessionId;

    try {
      const data = await api.getChatSession(sessionId);
      setCurrentSessionId(sessionId);
      setCurrentSessionTitle(data.session?.title || "Chat");

      // Convert stored messages to UIMessage format
      const storedMessages = data.session?.messages || [];
      const uiMessages = convertStoredToUIMessages(storedMessages);
      return uiMessages;
    } catch (err) {
      console.error("Failed to load session:", err);
      return null;
    }
  }, []);

  const startNewSession = useCallback(() => {
    activeSessionRef.current = null;
    setCurrentSessionId(null);
    setCurrentSessionTitle("New Chat");
  }, []);

  const createSession = useCallback(async (title: string, model?: string) => {
    try {
      const { session } = await api.createChatSession({
        title,
        model,
      });
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      setCurrentSessionTitle(session.title);
      activeSessionRef.current = session.id;
      return session;
    } catch (err) {
      console.error("Failed to create session:", err);
      return null;
    }
  }, []);

  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    try {
      await api.updateChatSession(sessionId, { title });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
      );
      if (currentSessionId === sessionId) {
        setCurrentSessionTitle(title);
      }
    } catch (err) {
      console.error("Failed to update session title:", err);
    }
  }, [currentSessionId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewSession();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }, [currentSessionId, startNewSession]);

  return {
    sessions,
    currentSessionId,
    currentSessionTitle,
    sessionsLoading,
    loadSessions,
    loadSession,
    startNewSession,
    createSession,
    updateSessionTitle,
    deleteSession,
    setCurrentSessionId,
    setCurrentSessionTitle,
  };
}
