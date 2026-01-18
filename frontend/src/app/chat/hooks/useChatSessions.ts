"use client";

import { useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { normalizeStoredMessage, type Message } from "../utils";
import type { ChatSession, ToolResult } from "@/lib/types";

interface UseChatSessionsOptions {
  currentSessionId: string | null;
  isMobile: boolean;
  setSessions: (sessions: ChatSession[]) => void;
  updateSessions: (updater: (sessions: ChatSession[]) => ChatSession[]) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setCurrentSessionTitle: (title: string) => void;
  setSessionsLoading: (loading: boolean) => void;
  setSessionsAvailable: (available: boolean) => void;
  setMessages: (messages: Message[]) => void;
  setSelectedModel: (modelId: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTitleDraft: (title: string) => void;
  setToolResultsMap: (map: Map<string, ToolResult>) => void;
  refreshUsage: (sessionId: string) => void;
}

export function useChatSessions({
  currentSessionId,
  isMobile,
  setSessions,
  updateSessions,
  setCurrentSessionId,
  setCurrentSessionTitle,
  setSessionsLoading,
  setSessionsAvailable,
  setMessages,
  setSelectedModel,
  setSidebarCollapsed,
  setTitleDraft,
  setToolResultsMap,
  refreshUsage,
}: UseChatSessionsOptions) {
  const loadingSessionRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getChatSessions();
      setSessions(data.sessions);
      setSessionsAvailable(true);
      if (currentSessionId) {
        const found = data.sessions.find((s) => s.id === currentSessionId);
        if (found?.title) setCurrentSessionTitle(found.title);
      }
    } catch {
      setSessions([]);
      setSessionsAvailable(false);
    } finally {
      setSessionsLoading(false);
    }
  }, [
    currentSessionId,
    setCurrentSessionTitle,
    setSessions,
    setSessionsAvailable,
    setSessionsLoading,
  ]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId || loadingSessionRef.current) return;
      loadingSessionRef.current = true;
      try {
        const { session } = await api.getChatSession(sessionId);
        if (activeSessionRef.current && activeSessionRef.current !== session.id) return;
        setCurrentSessionId(session.id);
        setCurrentSessionTitle(session.title);
        setTitleDraft(session.title);
        if (session.model) setSelectedModel(session.model);
        const msgs: Message[] = (session.messages || []).map(normalizeStoredMessage);
        setMessages(msgs);
        setToolResultsMap(new Map());
        refreshUsage(session.id);
        setSidebarCollapsed(isMobile);
      } catch {
        console.log("Failed to load session");
      } finally {
        loadingSessionRef.current = false;
      }
    },
    [
      isMobile,
      refreshUsage,
      setCurrentSessionId,
      setCurrentSessionTitle,
      setMessages,
      setSelectedModel,
      setSidebarCollapsed,
      setTitleDraft,
      setToolResultsMap,
    ],
  );

  const startNewSession = useCallback(() => {
    activeSessionRef.current = null;
  }, []);

  const setActiveSessionRef = useCallback((sessionId: string | null) => {
    activeSessionRef.current = sessionId;
  }, []);

  const bumpSessionUpdatedAt = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) return;
      updateSessions((prev) => {
        const existing = prev.find((s) => s.id === sessionId);
        const updated = existing
          ? { ...existing, updated_at: new Date().toISOString() }
          : undefined;
        return updated ? [updated, ...prev.filter((s) => s.id !== sessionId)] : prev;
      });
    },
    [updateSessions],
  );

  return {
    loadSessions,
    loadSession,
    startNewSession,
    setActiveSessionRef,
    bumpSessionUpdatedAt,
    loadingSessionRef,
    activeSessionRef,
  };
}
