// CRITICAL
"use client";

import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from "react";
import api from "@/lib/api";
import type { ChatMessage, ChatSession, ToolResult } from "@/lib/types";
import type { ChatRunStreamEvent } from "@/lib/api";
import {
  useChatRunStream,
  type AgentFinalReplyGuard,
  type AgentFinalReplyIssueKind,
} from "../../../chat-run-stream";
import { currentRunAfterLastUserHasAssistantText } from "@/app/chat/_components/messages/chat-message-list/visible-messages";
import { useAppStore } from "@/store";
import { useChatSendUserMessage } from "../../../chat-send-user-message";
import { pushStreamErrorToast } from "../use-stream-error-toast";
import type { Attachment } from "@/app/chat/types";
import type {
  AgentFilesService,
  ChatPageStore,
  ChatSessionsService,
  RouterLike,
  SetMessages,
  SessionIdRef,
} from "../types/controller-types";

export interface UseChatRunActionsArgs {
  store: ChatPageStore;
  sessions: ChatSessionsService;
  agentFiles: AgentFilesService;

  isLoading: boolean;
  setMessages: SetMessages;
  setStreamError: (next: string | null) => void;

  lastUserInputRef: MutableRefObject<string>;
  replaceUrlToSession: (sessionId: string) => void;
  setLastSessionId: (sessionId: string) => void;

  activeRunIdRef: MutableRefObject<string | null>;
  runAbortControllerRef: MutableRefObject<AbortController | null>;
  runCompletedRef: MutableRefObject<boolean>;
  lastEventTimeRef: MutableRefObject<number>;
  sessionIdRef: SessionIdRef;
  setIsLoading: (next: boolean) => void;
  setStreamStalled: (next: boolean) => void;
  setExecutingTools: (next: Set<string>) => void;
  setToolResultsMap: (next: Map<string, ToolResult>) => void;
  handleRunEvent: (event: ChatRunStreamEvent) => void;
  router: RouterLike;
}

export function useChatRunActions({
  store,
  sessions,
  agentFiles,
  isLoading,
  setMessages,
  setStreamError,
  lastUserInputRef,
  replaceUrlToSession,
  setLastSessionId,
  activeRunIdRef,
  runAbortControllerRef,
  runCompletedRef,
  lastEventTimeRef,
  sessionIdRef,
  setIsLoading,
  setStreamStalled,
  setExecutingTools,
  setToolResultsMap,
  handleRunEvent,
  router,
}: UseChatRunActionsArgs) {
  const userStoppedStreamRef = useRef(false);
  const agentFinalReplyGuardRef = useRef<AgentFinalReplyGuard | null>(null);
  useLayoutEffect(() => {
    agentFinalReplyGuardRef.current = {
      isAgentMode: () => useAppStore.getState().agentMode,
      currentRunHasFinalAssistantText: () =>
        currentRunAfterLastUserHasAssistantText(useAppStore.getState().messages),
      onMissingFinalAssistant: (kind: AgentFinalReplyIssueKind) => {
        const copy: Record<AgentFinalReplyIssueKind, string> = {
          turn_gap_no_run_end:
            "The assistant did not produce a final reply before the stream stalled. Open Computer in the sidebar for tool output and files, then retry.",
          stream_closed_without_run_end:
            "The connection closed before the run finished and no final assistant message was received. Open Computer for tool output and files, then retry.",
          run_end_without_visible_reply:
            "The run ended without a visible assistant answer. Open Computer for tool results, or try again.",
        };
        const msg = copy[kind];
        setStreamError(msg);
        pushStreamErrorToast(msg, {
          activeRunId: activeRunIdRef.current,
          lastEventTime: lastEventTimeRef.current,
        });
      },
      abortServerRun: async () => {
        const sid = sessionIdRef.current;
        const rid = activeRunIdRef.current;
        if (sid && rid) await api.abortChatRun(sid, rid).catch(() => {});
      },
    };
  }, [setStreamError]);

  const { startRunStream } = useChatRunStream({
    activeRunIdRef,
    runAbortControllerRef,
    runCompletedRef,
    lastEventTimeRef,
    sessionIdRef,
    setIsLoading,
    setStreamError,
    setStreamStalled,
    setExecutingTools,
    setToolResultsMap,
    handleRunEvent,
    agentFinalReplyGuardRef,
    userStoppedStreamRef,
  });

  const { sendUserMessage } = useChatSendUserMessage({
    selectedModel: store.selectedModel,
    systemPrompt: store.systemPrompt,
    deepResearchEnabled: store.deepResearch.enabled,
    agentMode: store.agentMode,
    currentSessionId: sessions.currentSessionId,
    isLoading,
    agentFiles: agentFiles.agentFiles,
    agentFileVersions: agentFiles.agentFileVersions,
    setInput: store.setInput,
    setMessages,
    setStreamError,
    setStreamingStartTime: store.setStreamingStartTime,
    lastUserInputRef,
    createSession: sessions.createSession,
    setLastSessionId,
    replaceUrlToSession,
    startRunStream,
    loadAgentFiles: agentFiles.loadAgentFiles,
  });

  const handleSend = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      await sendUserMessage(text, attachments, { clearInput: true });
    },
    [sendUserMessage],
  );

  const handleReprompt = useCallback(
    async (messageId: string, messages: ChatMessage[]) => {
      if (isLoading) return;
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex <= 0) return;

      const previousUser = [...messages.slice(0, messageIndex)]
        .reverse()
        .find((msg) => msg.role === "user");

      if (!previousUser) return;

      const userText = previousUser.parts
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("");

      if (!userText.trim()) return;
      await sendUserMessage(userText);
    },
    [isLoading, sendUserMessage],
  );

  const handleForkMessage = useCallback(
    async (messageId: string) => {
      if (!sessions.currentSessionId) return;
      try {
        const { session } = await api.forkChatSession(sessions.currentSessionId, {
          message_id: messageId,
          model: store.selectedModel || undefined,
          title: "New Chat",
        });
        store.updateSessions((sessionsList) => {
          if (sessionsList.some((existing: ChatSession) => existing.id === session.id)) {
            return sessionsList.map((existing: ChatSession) =>
              existing.id === session.id ? session : existing,
            );
          }
          return [session, ...sessionsList];
        });
        router.push(`/chat?session=${session.id}`);
      } catch (err) {
        console.error("Failed to fork session:", err);
      }
    },
    [router, sessions.currentSessionId, store],
  );

  const handleStop = useCallback(async () => {
    userStoppedStreamRef.current = true;
    runAbortControllerRef.current?.abort();
    const runId = activeRunIdRef.current;
    if (runId && sessions.currentSessionId) {
      try {
        await api.abortChatRun(sessions.currentSessionId, runId);
      } catch (err) {
        console.warn("Failed to abort run:", err);
      }
    }
    activeRunIdRef.current = null;
    store.setStreamingStartTime(null);
    store.setElapsedSeconds(0);
    setIsLoading(false);
    // Clear tool execution state so amber spinners don't get stuck
    setExecutingTools(new Set());
  }, [
    activeRunIdRef,
    runAbortControllerRef,
    sessions.currentSessionId,
    setIsLoading,
    setExecutingTools,
    store,
  ]);

  return { handleSend, handleReprompt, handleForkMessage, handleStop };
}
