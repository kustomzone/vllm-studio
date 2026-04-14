"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import api, { type ChatRunStreamEvent } from "@/lib/api";
import { createUuid } from "@/lib/uuid";
import { parseChatModelId } from "@/app/chat/types";
import {
  useChatSessions,
  useChatTools,
  useChatMessageMapping,
  useChatScroll,
  useCurrentToolCall,
  useRunToolCalls,
  useAvailableModels,
} from "@/app/chat/hooks";
import type { ToolResult, DeepResearchConfig } from "@/lib/types";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";

import type { ModelOption } from "@/app/chat/types";

export interface ChatController {
  // Sessions
  sessions: Array<{ id: string; title: string }>;
  currentSessionId: string | null;
  currentSessionTitle: string;
  loadSession: (id: string) => void;
  startNewSession: () => void;
  deleteSession: (id: string) => void;

  // Messages
  messages: Array<import("@/lib/types").ChatMessage>;
  isLoading: boolean;

  // Sending
  sendMessage: (text: string) => Promise<void>;

  // Tools / computer
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
  currentToolCall: CurrentToolCall | null;
  runToolCalls: CurrentToolCall[];
  focusToolCall: (toolCallId: string) => void;

  // Settings
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  availableModels: ModelOption[];
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  customChatModels: string[];
  addCustomChatModel: (id: string) => void;
  removeCustomChatModel: (id: string) => void;
  deepResearch: DeepResearchConfig;
  setDeepResearch: (config: DeepResearchConfig) => void;
}

export function useChatController(): ChatController {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Store
  const store = useAppStore(
    useShallow((s) => ({
      messages: s.messages,
      selectedModel: s.selectedModel,
      availableModels: s.availableModels,
      systemPrompt: s.systemPrompt,
      customChatModels: s.customChatModels,
      agentMode: s.agentMode,
      deepResearch: s.deepResearch,
      updateMessages: s.updateMessages,
      setSelectedModel: s.setSelectedModel,
      setAvailableModels: s.setAvailableModels,
      setSystemPrompt: s.setSystemPrompt,
      setCustomChatModels: s.setCustomChatModels,
      setAgentPlan: s.setAgentPlan,
      setAgentFiles: s.setAgentFiles,
      setExecutingTools: s.setExecutingTools,
      updateExecutingTools: s.updateExecutingTools,
      setToolResultsMap: s.setToolResultsMap,
      updateToolResultsMap: s.updateToolResultsMap,
      setDeepResearch: s.setDeepResearch,
    })),
  );

  // Hooks we keep
  const sessions = useChatSessions();
  const tools = useChatTools();
  const setMessages = useCallback(
    (next: import("@/lib/types").ChatMessage[] | ((prev: import("@/lib/types").ChatMessage[]) => import("@/lib/types").ChatMessage[])) => {
      if (typeof next === "function") {
        store.updateMessages(next as (prev: import("@/lib/types").ChatMessage[]) => import("@/lib/types").ChatMessage[]);
      } else {
        store.updateMessages(() => next);
      }
    },
    [store.updateMessages],
  );
  const messageMapping = useChatMessageMapping({ setMessages });

  const [isLoading, setIsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const activeRunIdRef = useRef<string | null>(null);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const runCompletedRef = useRef(false);
  const lastEventTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(sessions.currentSessionId);

  useEffect(() => { sessionIdRef.current = sessions.currentSessionId; }, [sessions.currentSessionId]);

  // Model list
  useAvailableModels({
    selectedModel: store.selectedModel,
    setSelectedModel: store.setSelectedModel,
    setAvailableModels: store.setAvailableModels,
    customChatModels: store.customChatModels,
  });

  // Computer viewport hooks
  const currentToolCall = useCurrentToolCall({
    messages: store.messages,
    isLoading,
    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
  });

  const runToolCalls = useRunToolCalls({
    messages: store.messages,
    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
  });

  // Focus tool call — for now just a no-op placeholder
  // In future: could scroll to the tool row in the message list
  const focusToolCall = useCallback((_toolCallId: string) => {}, []);

  // --- SSE stream handler ---
  const handleRunEvent = useCallback(
    (event: ChatRunStreamEvent) => {
      const data = event.data;
      if (!data) return;

      switch (event.event) {
        case "run_start": {
          activeRunIdRef.current = typeof data.run_id === "string" ? data.run_id : null;
          break;
        }
        case "message_start":
        case "message_update": {
          const mapped = messageMapping.mapAgentMessageToChatMessage(
            data as Record<string, unknown>,
            typeof data.message_id === "string" ? data.message_id : undefined,
            { runId: activeRunIdRef.current ?? undefined },
          );
          if (mapped) messageMapping.upsertMessage(mapped);
          break;
        }
        case "tool_execution_start": {
          if (typeof data.tool_call_id === "string") {
            tools.updateExecutingTools((prev) => new Set([...prev, data.tool_call_id as string]));
          }
          break;
        }
        case "tool_execution_end": {
          if (typeof data.tool_call_id === "string") {
            tools.updateExecutingTools((prev) => {
              const next = new Set(prev);
              next.delete(data.tool_call_id as string);
              return next;
            });
          }
          break;
        }
        case "tool_result": {
          if (typeof data.tool_call_id === "string") {
            const result: ToolResult = {
              tool_call_id: data.tool_call_id,
              content: typeof data.content === "string" ? data.content : JSON.stringify(data.content),
              isError: data.is_error === true,
            };
            tools.updateToolResultsMap((prev) => new Map(prev).set(result.tool_call_id, result));
          }
          break;
        }
        case "run_end": {
          runCompletedRef.current = true;
          activeRunIdRef.current = null;
          break;
        }
      }
    },
    [messageMapping, tools],
  );

  // --- Send message ---
  const sendMessage = useCallback(
    async (text: string) => {
      const safeText = text.trim();
      if (!safeText || isLoading) return;

      setIsLoading(true);
      setStreamError(null);
      tools.setExecutingTools(new Set());
      tools.setToolResultsMap(new Map());

      const messageId = createUuid();

      // Optimistic user message
      const userMessage = {
        id: messageId,
        role: "user" as const,
        parts: [{ type: "text" as const, text: safeText }],
      };
      store.updateMessages((prev) => [...prev, userMessage]);
      const removeOptimistic = () => store.updateMessages((prev) => prev.filter((m) => m.id !== messageId));

      // Ensure session exists
      let sessionId = sessionIdRef.current;
      if (!sessionId) {
        const session = await sessions.createSession("New Chat", store.selectedModel);
        if (!session) {
          removeOptimistic();
          setStreamError("Failed to create session");
          setIsLoading(false);
          return;
        }
        sessionId = session.id;
        router.replace(`/chat2?session=${sessionId}`, { scroll: false });
      }

      // Title generation
      if (sessions.currentSessionTitle === "New Chat" || sessions.currentSessionTitle === "Chat") {
        void sessions.updateSessionTitle(sessionId, safeText.slice(0, 60));
      }

      // Start stream
      const parsedModel = parseChatModelId(store.selectedModel);
      const runModel = parsedModel.id || undefined;
      const runProvider = runModel ? parsedModel.provider : undefined;

      const abortController = new AbortController();
      runAbortControllerRef.current = abortController;
      runCompletedRef.current = false;

      try {
        const { stream } = await api.streamChatRun(
          sessionId,
          {
            content: safeText,
            message_id: messageId,
            ...(runModel ? { model: runModel } : {}),
            ...(runProvider ? { provider: runProvider } : {}),
            system: store.systemPrompt.trim() || undefined,
            agent_mode: store.agentMode,
            deep_research: store.deepResearch?.enabled,
          },
          { signal: abortController.signal },
        );

        for await (const event of stream) {
          lastEventTimeRef.current = Date.now();
          if (event.event === "keepalive") continue;
          handleRunEvent(event);
          if (event.event === "run_end") {
            runCompletedRef.current = true;
            abortController.abort();
            break;
          }
        }

        if (!runCompletedRef.current) runCompletedRef.current = true;
      } catch (err) {
        if (!abortController.signal.aborted && !runCompletedRef.current) {
          setStreamError(err instanceof Error ? err.message : String(err));
          if (!activeRunIdRef.current) removeOptimistic();
        }
      } finally {
        activeRunIdRef.current = null;
        runAbortControllerRef.current = null;
        setIsLoading(false);
        tools.setExecutingTools(new Set());
      }
    },
    [isLoading, store, sessions, tools, handleRunEvent, router],
  );

  // --- Load session on mount ---
  useEffect(() => {
    const urlSession = searchParams.get("session");
    if (urlSession) {
      void sessions.loadSession(urlSession);
    } else {
      sessions.loadSessions();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Custom model helpers
  const addCustomChatModel = useCallback(
    (id: string) => store.setCustomChatModels([...store.customChatModels, id]),
    [store],
  );
  const removeCustomChatModel = useCallback(
    (id: string) => store.setCustomChatModels(store.customChatModels.filter((m) => m !== id)),
    [store],
  );

  return {
    sessions: sessions.sessions,
    currentSessionId: sessions.currentSessionId,
    currentSessionTitle: sessions.currentSessionTitle,
    loadSession: (id: string) => void sessions.loadSession(id),
    startNewSession: sessions.startNewSession,
    deleteSession: (id: string) => void sessions.deleteSession(id),

    messages: store.messages,
    isLoading,
    sendMessage,

    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
    currentToolCall,
    runToolCalls,
    focusToolCall,

    selectedModel: store.selectedModel,
    setSelectedModel: store.setSelectedModel,
    availableModels: store.availableModels,
    systemPrompt: store.systemPrompt,
    setSystemPrompt: store.setSystemPrompt,
    customChatModels: store.customChatModels,
    addCustomChatModel,
    removeCustomChatModel,
    deepResearch: store.deepResearch,
    setDeepResearch: store.setDeepResearch,
  };
}
