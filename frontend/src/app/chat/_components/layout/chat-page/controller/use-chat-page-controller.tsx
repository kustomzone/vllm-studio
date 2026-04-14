// CRITICAL
"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as Hooks from "../../../../hooks";
import { useRunMachine } from "@/lib/systems/run-machine";
import type { SidebarTab } from "../../sidebar/unified-sidebar";
import { buildAgentModeSystemPrompt } from "../../../../utils/agent-system-prompt";
import { getLastSessionId, setLastSessionId } from "./last-session-id";
import type { ChatPageViewProps } from "../view/chat-page-view/types";
import { useChatPageEvents } from "./use-chat-page-events";
import { useChatPageStore } from "./internal/use-chat-page-store";
import { useThinkingSnippet } from "./internal/use-thinking-snippet";
import { useChatPageLifecycle } from "./internal/use-chat-page-lifecycle";
import { useChatTitleGenerator } from "./internal/use-chat-title-generator";
import { useChatPageControllerTail } from "./internal/use-chat-page-controller-tail";

export function useChatPageController(): ChatPageViewProps {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionFromUrl = searchParams.get("session");
  const newChatFromUrl = searchParams.get("new") === "1";

  const store = useChatPageStore();

  const effectiveSystemPrompt = useMemo(() => {
    const base = store.systemPrompt.trim();
    if (!store.agentMode) return base;
    const agentBlock = buildAgentModeSystemPrompt(store.agentPlan);
    return base ? `${base}\n\n${agentBlock}` : agentBlock;
  }, [store.systemPrompt, store.agentMode, store.agentPlan]);

  // Refs
  const messages = Hooks.useChatMessages();
  const setMessages = Hooks.useSetChatMessages();
  const [isLoading, setIsLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamStalled, setStreamStalled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("activity");
  const activeRunIdRef = useRef<string | null>(null);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const runCompletedRef = useRef(false);
  const lastEventTimeRef = useRef<number>(0);

  // Track the last user input for title generation
  const lastUserInputRef = useRef<string>("");

  const agentFilesService = Hooks.useAgentFiles();
  const agentState = Hooks.useAgentState();
  const sessions = Hooks.useChatSessions();
  const tools = Hooks.useChatTools();
  const usage = Hooks.useChatUsage();
  const sessionIdRef = useRef<string | null>(sessions.currentSessionId);

  useEffect(() => {
    sessionIdRef.current = sessions.currentSessionId;
  }, [sessions.currentSessionId]);

  const messageMapping = Hooks.useChatMessageMapping({ setMessages });
  const toolResults = Hooks.useChatToolResults({
    setMessages,
    isToolPart: messageMapping.isToolPart,
    updateToolResultsMap: store.updateToolResultsMap,
  });

  const generateTitle = useChatTitleGenerator({
    selectedModel: store.selectedModel || "",
    setCurrentSessionTitle: sessions.setCurrentSessionTitle,
    updateSessions: store.updateSessions,
  });

  const { handleRunEvent } = useRunMachine({
    currentSessionId: sessions.currentSessionId,
    currentSessionTitle: sessions.currentSessionTitle,
    activeRunIdRef,
    runAbortControllerRef,
    lastEventTimeRef,
    runCompletedRef,
    setStreamStalled,
    setIsLoading,
    setStreamError,
    setAgentPlan: store.setAgentPlan,
    generateTitle,
    recordToolExecutionMetadata: toolResults.recordToolExecutionMetadata,
    recordToolResult: toolResults.recordToolResult,
    updateExecutingTools: store.updateExecutingTools,
    mapAgentMessageToChatMessage: messageMapping.mapAgentMessageToChatMessage,
    upsertMessage: messageMapping.upsertMessage,
    loadAgentFiles: agentFilesService.loadAgentFiles,
    readAgentFile: agentFilesService.readAgentFile,
    moveAgentFileVersions: agentFilesService.moveAgentFileVersions,
  });

  const { hydrateAgentState, persistAgentState, buildAgentState } = agentState;

  const clearPlan = useCallback(() => {
    store.setAgentPlan(null);
    if (sessions.currentSessionId) {
      void persistAgentState(sessions.currentSessionId, buildAgentState(null));
    }
  }, [buildAgentState, persistAgentState, sessions.currentSessionId, store]);

  useChatPageEvents({
    currentSessionId: sessions.currentSessionId,
    hydrateAgentState,
    mapStoredMessages: messageMapping.mapStoredMessages,
    startNewSession: sessions.startNewSession,
    updateMessages: store.updateMessages,
  });

  // Computer viewport hooks
  const currentToolCall = Hooks.useCurrentToolCall({
    messages,
    isLoading,
    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
  });

  const runToolCalls = Hooks.useRunToolCalls({
    messages,
    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
  });

  // Derived state from messages
  const activityPanelVisible = sidebarOpen && sidebarTab === "activity";
  const contextPanelVisible = sidebarOpen && sidebarTab === "context";

  const { thinkingActive, thinkingState, activityGroups } = Hooks.useChatDerived({
    messages,
    isLoading,
    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
    enableActivityGroups: activityPanelVisible,
  });

  const activityCount = useMemo(() => {
    if (activityPanelVisible) {
      return activityGroups.reduce((sum, group) => sum + group.items.length, 0);
    }
    if (tools.executingTools.size > 0) return tools.executingTools.size;
    return isLoading ? 1 : 0;
  }, [activityGroups, activityPanelVisible, isLoading, tools.executingTools.size]);

  const thinkingSnippet = useThinkingSnippet({
    isLoading,
    streamStalled,
    executingTools: tools.executingTools,
    toolResultsMap: tools.toolResultsMap,
    thinkingStateContent: thinkingState.content,
    messages,
  });

  Hooks.useAvailableModels({
    selectedModel: store.selectedModel,
    setSelectedModel: store.setSelectedModel,
    setAvailableModels: store.setAvailableModels,
    customChatModels: store.customChatModels,
  });

  const { messagesContainerRef, messagesEndRef, handleScroll } = Hooks.useChatScroll({
    isLoading,
    messageCount: messages.length,
  });

  const { sessionArtifacts, artifactsByMessage, activeArtifact, clearArtifactsCache } =
    Hooks.useChatArtifacts({
      messages,
      artifactsEnabled: store.artifactsEnabled,
      currentSessionId: sessions.currentSessionId,
      activeArtifactId: store.activeArtifactId,
      setActiveArtifactId: store.setActiveArtifactId,
    });

  const context = Hooks.useChatContext({
    messages,
    selectedModel: store.selectedModel,
    availableModels: store.availableModels,
    effectiveSystemPrompt,
    contextPanelVisible,
    getToolDefinitions: tools.getToolDefinitions,
    isToolPart: messageMapping.isToolPart,
  });

  const compaction = Hooks.useChatCompaction({
    currentSessionId: sessions.currentSessionId,
    currentSessionTitle: sessions.currentSessionTitle,
    selectedModel: store.selectedModel,
    effectiveSystemPrompt,
    messages,
    isLoading,
    maxContext: context.maxContext,
    contextStats: context.contextStats,
    contextConfig: context.contextConfig,
    contextMessages: context.contextMessages,
    calculateMessageTokens: context.calculateMessageTokens,
    mapStoredMessages: messageMapping.mapStoredMessages,
    buildContextContent: context.buildContextContent,
    updateSessions: store.updateSessions,
    setCurrentSessionId: sessions.setCurrentSessionId,
    setCurrentSessionTitle: sessions.setCurrentSessionTitle,
    setMessages,
    hydrateAgentState: agentState.hydrateAgentState,
    loadAgentFiles: agentFilesService.loadAgentFiles,
    sessionIdRef,
    clearArtifactsCache,
  });

  const { contextStats, contextUsageLabel, contextBreakdown, formatTokenCount } = context;
  const {
    compactionHistory,
    compacting,
    compactionError,
    runManualCompaction,
    canManualCompact,
    resetCompaction,
  } = compaction;

  useChatPageLifecycle({
    store,
    sessions,
    agentFiles: agentFilesService,
    agentState,
    messageMapping,
    setMessages,
    sessionIdRef,
    newChatFromUrl,
    sessionFromUrl,
    isLoading,
    router,
    clearPlan,
    resetCompaction,
    executingToolsSize: tools.executingTools.size,
    activeRunIdRef,
    runAbortControllerRef,
    lastEventTimeRef,
    setStreamStalled,
    getLastSessionId,
    setLastSessionId,
  });

  // Wrap setUsageOpen to refresh usage when opening the modal
  const setUsageOpenWithRefresh = useCallback(
    (open: boolean) => {
      store.setUsageOpen(open);
      if (open && sessions.currentSessionId) {
        usage.refreshUsage(sessions.currentSessionId);
      }
    },
    [store, sessions.currentSessionId, usage],
  );

  return useChatPageControllerTail({
    store,
    sessions,
    tools,
    agentFiles: agentFilesService,
    router,
    sessionFromUrl,
    sidebarOpen,
    setSidebarOpen,
    sidebarTab,
    setSidebarTab,
    messages,
    setMessages,
    isLoading,
    streamError,
    streamStalled,
    setStreamError,
    setIsLoading,
    setStreamStalled,
    setUsageOpen: setUsageOpenWithRefresh,
    clearPlan,
    lastUserInputRef,
    generateTitle,
    handleRunEvent,
    activeRunIdRef,
    runAbortControllerRef,
    runCompletedRef,
    lastEventTimeRef,
    sessionIdRef,
    activityPanelVisible,
    currentToolCall,
    runToolCalls,
    thinkingActive,
    activityGroups,
    activityCount,
    thinkingSnippet,
    executingToolsSize: tools.executingTools.size,
    contextStats,
    contextBreakdown,
    contextUsageLabel,
    compactionHistory,
    compacting,
    compactionError,
    formatTokenCount,
    runManualCompaction,
    canManualCompact,
    sessionArtifacts,
    artifactsByMessage,
    activeArtifact,
    handleScroll,
    messagesContainerRef,
    messagesEndRef,
  });
}
