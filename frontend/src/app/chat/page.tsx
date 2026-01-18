"use client";

import { useEffect, useMemo, useCallback, Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Copy,
  GitBranch,
  X,
  BarChart3,
  MoreHorizontal,
  PanelRightOpen,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { shallow } from "zustand/shallow";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { ToolBelt, MCPSettingsModal, ChatSettingsModal, ChatSplashCanvas } from "@/components/chat";
import { MessageParsingProvider, useMessageParsing } from "@/lib/services/message-parsing";
import { ResearchProgressIndicator, CitationsPanel } from "@/components/chat/research-progress";
import { MessageSearch } from "@/components/chat/message-search";
import { ContextIndicator } from "@/components/chat/context-indicator";
import {
  useChatPersistence,
  useChatUI,
  useChatModel,
  useChatSessions,
  useChatTools,
  useChatUsage,
  useChatStream,
  useChatArtifacts,
  useChatDerived,
  useChatContext,
  useChatResearch,
} from "./hooks";

// Local components, hooks and utils
import { UsageModal, ExportModal, ChatMessageList, ChatSidePanel } from "./components";
import { downloadTextFile, type Message } from "./utils";

function ChatPageContent() {
  const {
    currentSessionId,
    currentSessionTitle,
    messages,
    input,
    isLoading,
    error,
    streamingStartTime,
    elapsedSeconds,
    queuedContext,
    runningModel,
    selectedModel,
    availableModels,
    pageLoading,
    copiedIndex,
    sidebarCollapsed,
    toolPanelOpen,
    activePanel,
    mcpEnabled,
    artifactsEnabled,
    mcpServers,
    mcpSettingsOpen,
    mcpTools,
    executingTools,
    toolResultsMap,
    systemPrompt,
    chatSettingsOpen,
    deepResearch,
    researchProgress,
    researchSources,
    sessionUsage,
    usageDetailsOpen,
    exportOpen,
    messageSearchOpen,
    bookmarkedMessages,
    userScrolledUp,
  } = useAppStore(
    (state) => ({
      currentSessionId: state.currentSessionId,
      currentSessionTitle: state.currentSessionTitle,
      messages: state.messages,
      input: state.input,
      isLoading: state.isLoading,
      error: state.error,
      streamingStartTime: state.streamingStartTime,
      elapsedSeconds: state.elapsedSeconds,
      queuedContext: state.queuedContext,
      runningModel: state.runningModel,
      selectedModel: state.selectedModel,
      availableModels: state.availableModels,
      pageLoading: state.pageLoading,
      copiedIndex: state.copiedIndex,
      sidebarCollapsed: state.sidebarCollapsed,
      toolPanelOpen: state.toolPanelOpen,
      activePanel: state.activePanel,
      mcpEnabled: state.mcpEnabled,
      artifactsEnabled: state.artifactsEnabled,
      mcpServers: state.mcpServers,
      mcpSettingsOpen: state.mcpSettingsOpen,
      mcpTools: state.mcpTools,
      executingTools: state.executingTools,
      toolResultsMap: state.toolResultsMap,
      systemPrompt: state.systemPrompt,
      chatSettingsOpen: state.chatSettingsOpen,
      deepResearch: state.deepResearch,
      researchProgress: state.researchProgress,
      researchSources: state.researchSources,
      sessionUsage: state.sessionUsage,
      usageDetailsOpen: state.usageDetailsOpen,
      exportOpen: state.exportOpen,
      messageSearchOpen: state.messageSearchOpen,
      bookmarkedMessages: state.bookmarkedMessages,
      userScrolledUp: state.userScrolledUp,
    }),
    shallow,
  );

  const {
    setSessions,
    updateSessions,
    setCurrentSessionId,
    setCurrentSessionTitle,
    setSessionsLoading,
    setSessionsAvailable,
    setMessages,
    updateMessages,
    setInput,
    setIsLoading,
    setError,
    setStreamingStartTime,
    setElapsedSeconds,
    setQueuedContext,
    setRunningModel,
    setModelName,
    setSelectedModel,
    setAvailableModels,
    setPageLoading,
    setCopiedIndex,
    setSidebarCollapsed,
    setIsMobile,
    setToolPanelOpen,
    setActivePanel,
    setMcpEnabled,
    setArtifactsEnabled,
    setMcpServers,
    setMcpSettingsOpen,
    setMcpTools,
    updateExecutingTools,
    setToolResultsMap,
    updateToolResultsMap,
    setSystemPrompt,
    setChatSettingsOpen,
    setDeepResearch,
    setResearchProgress,
    setResearchSources,
    setSessionUsage,
    setUsageDetailsOpen,
    setExportOpen,
    setMessageSearchOpen,
    updateBookmarkedMessages,
    setTitleDraft,
    setUserScrolledUp,
  } = useAppStore(
    (state) => ({
      setSessions: state.setSessions,
      updateSessions: state.updateSessions,
      setCurrentSessionId: state.setCurrentSessionId,
      setCurrentSessionTitle: state.setCurrentSessionTitle,
      setSessionsLoading: state.setSessionsLoading,
      setSessionsAvailable: state.setSessionsAvailable,
      setMessages: state.setMessages,
      updateMessages: state.updateMessages,
      setInput: state.setInput,
      setIsLoading: state.setIsLoading,
      setError: state.setError,
      setStreamingStartTime: state.setStreamingStartTime,
      setElapsedSeconds: state.setElapsedSeconds,
      setQueuedContext: state.setQueuedContext,
      setRunningModel: state.setRunningModel,
      setModelName: state.setModelName,
      setSelectedModel: state.setSelectedModel,
      setAvailableModels: state.setAvailableModels,
      setPageLoading: state.setPageLoading,
      setCopiedIndex: state.setCopiedIndex,
      setSidebarCollapsed: state.setSidebarCollapsed,
      setIsMobile: state.setIsMobile,
      setToolPanelOpen: state.setToolPanelOpen,
      setActivePanel: state.setActivePanel,
      setMcpEnabled: state.setMcpEnabled,
      setArtifactsEnabled: state.setArtifactsEnabled,
      setMcpServers: state.setMcpServers,
      setMcpSettingsOpen: state.setMcpSettingsOpen,
      setMcpTools: state.setMcpTools,
      updateExecutingTools: state.updateExecutingTools,
      setToolResultsMap: state.setToolResultsMap,
      updateToolResultsMap: state.updateToolResultsMap,
      setSystemPrompt: state.setSystemPrompt,
      setChatSettingsOpen: state.setChatSettingsOpen,
      setDeepResearch: state.setDeepResearch,
      setResearchProgress: state.setResearchProgress,
      setResearchSources: state.setResearchSources,
      setSessionUsage: state.setSessionUsage,
      setUsageDetailsOpen: state.setUsageDetailsOpen,
      setExportOpen: state.setExportOpen,
      setMessageSearchOpen: state.setMessageSearchOpen,
      updateBookmarkedMessages: state.updateBookmarkedMessages,
      setTitleDraft: state.setTitleDraft,
      setUserScrolledUp: state.setUserScrolledUp,
    }),
    shallow,
  );

  // Message parsing service
  const { parseThinking, parseArtifacts, extractThinkingBlocks } = useMessageParsing();

  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get("session");
  const newChatFromUrl = searchParams.get("new") === "1";
  const renderDebug = searchParams.get("render_debug") === "1";

  const { hydrated, storedSystemPrompt, persist, saveSystemPrompt } = useChatPersistence();

  const { isMobile } = useChatUI({
    onSidebarCollapsedChange: setSidebarCollapsed,
    onIsMobileChange: setIsMobile,
  });

  const { loadAvailableModels, loadStatus } = useChatModel({
    selectedModel,
    setRunningModel,
    setModelName,
    setSelectedModel,
    setAvailableModels,
    setPageLoading,
  });

  const { refreshUsage } = useChatUsage({ setSessionUsage });

  const {
    loadSessions,
    loadSession,
    startNewSession,
    setActiveSessionRef,
    bumpSessionUpdatedAt,
    loadingSessionRef,
    activeSessionRef,
  } = useChatSessions({
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
  });

  const { loadMCPServers, loadMCPTools, getOpenAITools, executeMCPTool } = useChatTools({
    mcpEnabled,
    mcpTools,
    setMcpServers,
    setMcpTools,
  });

  const { updateDeepResearch } = useChatResearch({
    deepResearch,
    setDeepResearch,
    setMcpEnabled,
  });

  const { sessionArtifacts } = useChatArtifacts({
    artifactsEnabled,
    currentSessionId,
    messages,
    parsing: { parseArtifacts },
  });

  const {
    allToolCalls,
    lastAssistantMessage,
    thinkingState,
    thinkingActive,
    activityItems,
    hasToolActivity,
    hasSidePanelContent,
  } = useChatDerived({
    messages,
    isLoading,
    executingTools,
    researchProgress,
    sessionArtifacts,
    parseThinking,
    extractThinkingBlocks,
  });

  const maxContext = useMemo(() => {
    const model = availableModels.find((m) => m.id === selectedModel || m.id === runningModel);
    return model?.max_model_len || 200000;
  }, [availableModels, selectedModel, runningModel]);

  const handleContextCompact = useCallback(
    (newMessages: Array<{ role: string; content: string }>) => {
      const compactedIds = new Set(
        newMessages
          .map((_, index) => messages[messages.length - newMessages.length + index]?.id)
          .filter(Boolean),
      );
      updateMessages((prev: Message[]) =>
        prev.filter(
          (m) => compactedIds.has(m.id) || prev.indexOf(m) >= prev.length - newMessages.length,
        ),
      );
    },
    [messages, updateMessages],
  );

  const { contextManager } = useChatContext({
    messages: messages.map((m) => ({ role: m.role, content: m.content, id: m.id })),
    maxContext,
    systemPrompt,
    mcpEnabled,
    mcpTools,
    onCompact: handleContextCompact,
  });

  const { sendMessage, stopGeneration } = useChatStream({
    input,
    messages,
    selectedModel,
    runningModel,
    systemPrompt,
    mcpEnabled,
    mcpTools,
    currentSessionId,
    sessionFromUrl,
    currentSessionTitle,
    updateMessages,
    setInput,
    setIsLoading,
    setStreamingStartTime,
    setElapsedSeconds,
    setError,
    setCurrentSessionId,
    setCurrentSessionTitle,
    setTitleDraft,
    updateToolResultsMap,
    updateSessions,
    setSessionsAvailable,
    updateExecutingTools,
    refreshUsage,
    bumpSessionUpdatedAt,
    parseThinking,
    getOpenAITools,
    executeMCPTool,
    loadingSessionRef,
    activeSessionRef,
  });

  const showEmptyState = messages.length === 0 && !isLoading && !error;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setUserScrolledUp(distanceFromBottom >= 160);
  }, [setUserScrolledUp]);

  // Effects
  useEffect(() => {
    if (!hydrated) return;
    setInput(hydrated.input || "");
    setMcpEnabled(hydrated.mcpEnabled);
    setArtifactsEnabled(hydrated.artifactsEnabled);
    if (hydrated.selectedModel) {
      setSelectedModel(hydrated.selectedModel);
    }
    if (storedSystemPrompt && !systemPrompt) {
      setSystemPrompt(storedSystemPrompt);
    }
    if (typeof hydrated.sidebarCollapsed === "boolean") {
      setSidebarCollapsed(hydrated.sidebarCollapsed);
    }
  }, [
    hydrated,
    setArtifactsEnabled,
    setInput,
    setMcpEnabled,
    setSelectedModel,
    setSidebarCollapsed,
    setSystemPrompt,
    storedSystemPrompt,
    systemPrompt,
  ]);

  useEffect(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isLoading ? "auto" : "smooth",
      });
    }
  }, [isLoading, messages, userScrolledUp]);

  useEffect(() => {
    persist({
      input,
      mcpEnabled,
      artifactsEnabled,
      systemPrompt,
      selectedModel,
      sidebarCollapsed,
    });
  }, [artifactsEnabled, input, mcpEnabled, persist, selectedModel, sidebarCollapsed, systemPrompt]);

  useEffect(() => {
    loadStatus();
    loadSessions();
    loadMCPServers();
    loadAvailableModels();
  }, [loadAvailableModels, loadMCPServers, loadSessions, loadStatus]);

  useEffect(() => {
    if (newChatFromUrl) {
      startNewSession();
      setCurrentSessionId(null);
      setCurrentSessionTitle("New Chat");
      setTitleDraft("New Chat");
      setMessages([]);
      setToolResultsMap(new Map());
      updateExecutingTools(() => new Set());
      setResearchProgress(null);
      setResearchSources([]);
      setSessionUsage(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!sessionFromUrl) return;

    if (activeSessionRef.current !== sessionFromUrl) {
      setActiveSessionRef(sessionFromUrl);
      setMessages([]);
      setToolResultsMap(new Map());
      updateExecutingTools(() => new Set());
      setResearchProgress(null);
      setResearchSources([]);
      setSessionUsage(null);
      setError(null);
      setIsLoading(false);
      loadSession(sessionFromUrl);
    }
  }, [
    activeSessionRef,
    loadSession,
    newChatFromUrl,
    sessionFromUrl,
    setActiveSessionRef,
    setCurrentSessionId,
    setCurrentSessionTitle,
    setError,
    setIsLoading,
    setMessages,
    setResearchProgress,
    setResearchSources,
    setSessionUsage,
    setTitleDraft,
    setToolResultsMap,
    startNewSession,
    updateExecutingTools,
  ]);

  useEffect(() => {
    if (mcpEnabled) loadMCPTools();
    else setMcpTools([]);
  }, [loadMCPTools, mcpEnabled, setMcpTools]);

  useEffect(() => {
    if (sessionArtifacts.length > 0 && activePanel === "tools" && !hasToolActivity) {
      setActivePanel("artifacts");
    }
  }, [activePanel, hasToolActivity, sessionArtifacts.length, setActivePanel]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isLoading && streamingStartTime) {
      intervalId = setInterval(
        () => setElapsedSeconds(Math.floor((Date.now() - streamingStartTime) / 1000)),
        1000,
      );
    } else if (!isLoading) {
      const timeoutId = setTimeout(() => {
        if (!isLoading) {
          setStreamingStartTime(null);
          setElapsedSeconds(0);
        }
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading, setElapsedSeconds, setStreamingStartTime, streamingStartTime]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  const forkAtMessage = async (messageId: string) => {
    if (!currentSessionId) return;
    try {
      const { session } = await api.forkChatSession(currentSessionId, {
        message_id: messageId,
        model: selectedModel || undefined,
      });
      updateSessions((prev) => [session, ...prev]);
      await loadSession(session.id);
    } catch {}
  };

  const toggleBookmark = (messageId: string) => {
    updateBookmarkedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };
  const copyLastResponse = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    copyToClipboard(last.content, messages.indexOf(last));
  };

  // Export functions
  const buildChatExport = () => ({
    title: currentSessionTitle || "Chat",
    session_id: currentSessionId,
    model: selectedModel || runningModel || null,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      model: m.model ?? null,
      content: m.content,
      tool_calls: m.toolCalls ?? null,
      tool_results: m.toolResults ?? null,
    })),
    session_usage: sessionUsage,
  });
  const exportAsJson = () => {
    const payload = buildChatExport();
    const name = (currentSessionTitle || "chat").replace(/[^\w.-]+/g, "_").slice(0, 80);
    downloadTextFile(`${name}.json`, JSON.stringify(payload, null, 2), "application/json");
  };
  const exportAsMarkdown = () => {
    const payload = buildChatExport();
    const lines = [`# ${payload.title}`, ""];
    if (payload.model) lines.push(`- Model: \`${payload.model}\``);
    lines.push("");
    payload.messages.forEach((m) => {
      lines.push(`## ${m.role === "user" ? "User" : "Assistant"}`, "", m.content || "", "");
    });
    const name = (currentSessionTitle || "chat").replace(/[^\w.-]+/g, "_").slice(0, 80);
    downloadTextFile(`${name}.md`, lines.join("\n"), "text/markdown");
  };

  const toolBelt = (
    <ToolBelt
      value={input}
      onChange={setInput}
      onSubmit={sendMessage}
      onStop={stopGeneration}
      disabled={!(selectedModel || runningModel || "").trim()}
      isLoading={isLoading}
      placeholder={selectedModel || runningModel ? "Message..." : "Select a model in Settings"}
      mcpEnabled={mcpEnabled}
      onMcpToggle={() => setMcpEnabled(!mcpEnabled)}
      artifactsEnabled={artifactsEnabled}
      onArtifactsToggle={() => setArtifactsEnabled(!artifactsEnabled)}
      onOpenMcpSettings={() => setMcpSettingsOpen(true)}
      onOpenChatSettings={() => setChatSettingsOpen(true)}
      hasSystemPrompt={systemPrompt.trim().length > 0}
      deepResearchEnabled={deepResearch.enabled}
      onDeepResearchToggle={() => {
        const nextEnabled = !deepResearch.enabled;
        setDeepResearch({ ...deepResearch, enabled: nextEnabled });
        if (nextEnabled && !mcpEnabled) setMcpEnabled(true);
      }}
      elapsedSeconds={elapsedSeconds}
      queuedContext={queuedContext}
      onQueuedContextChange={setQueuedContext}
    />
  );

  // Render
  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse-soft">
          <Sparkles className="h-8 w-8 text-[#9a9590]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative h-full flex overflow-hidden w-full max-w-full">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden">
          <div className="flex-1 flex overflow-hidden relative min-w-0">
            {messageSearchOpen && (
              <div className="absolute inset-0 z-50 bg-(--background)/95 backdrop-blur-sm">
                <div className="h-full flex flex-col max-w-2xl mx-auto">
                  <div className="flex items-center justify-between p-4 border-b border-(--border)">
                    <h2 className="text-lg font-semibold">Search Messages</h2>
                    <button
                      onClick={() => setMessageSearchOpen(false)}
                      className="p-2 rounded hover:bg-(--accent)"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <MessageSearch
                      messages={messages}
                      onResultClick={(messageId) => {
                        document.getElementById(`message-${messageId}`)?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        setMessageSearchOpen(false);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col"
              >
                <div className="pb-0 md:pb-4 flex-1 flex flex-col">
                  {
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center px-4 md:px-6 py-10 transition-opacity duration-500 ease-out bg-[hsl(30,5%,10.5%)]">
                      <ChatSplashCanvas active={showEmptyState} />
                      {showEmptyState && (
                        <div className="relative z-10 w-full max-w-2xl">
                          <div>{toolBelt}</div>
                        </div>
                      )}
                      {!showEmptyState && (
                        <div className="relative z-10 flex flex-col min-h-0 w-full">
                          <ChatMessageList
                            messages={messages}
                            currentSessionId={currentSessionId}
                            bookmarkedMessages={bookmarkedMessages}
                            artifactsEnabled={artifactsEnabled}
                            isLoading={isLoading}
                            error={error}
                            copiedIndex={copiedIndex}
                            renderDebug={renderDebug}
                            onCopy={copyToClipboard}
                            onFork={forkAtMessage}
                            onToggleBookmark={toggleBookmark}
                          />

                          {isMobile && researchProgress && (
                            <ResearchProgressIndicator
                              progress={researchProgress}
                              onCancel={() => setResearchProgress(null)}
                            />
                          )}
                          {isMobile && researchSources.length > 0 && !researchProgress && (
                            <CitationsPanel sources={researchSources} />
                          )}

                          {lastAssistantMessage && !isLoading && (
                            <div className="max-w-4xl mx-auto px-4 md:px-6">
                              {isMobile ? (
                                <div className="mt-1.5 flex justify-end">
                                  <button
                                    onClick={() => setMobileActionsOpen(true)}
                                    className="p-2 rounded-full border border-(--border) bg-(--card) text-[#9a9590] hover:bg-(--accent)"
                                    title="Message actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-(--border) flex items-center justify-end gap-3">
                                  <div className="hidden sm:flex items-center gap-3 text-xs md:text-xs text-[#6a6560]">
                                    {sessionUsage && (
                                      <div
                                        className="flex items-center gap-1.5 cursor-pointer hover:text-[#9a9590]"
                                        onClick={() => setUsageDetailsOpen(true)}
                                      >
                                        <BarChart3 className="h-3.5 w-3.5 md:h-3 md:w-3" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>
                  }
                </div>
              </div>

              {!isMobile && (
                <div className="absolute right-3 top-3 z-10 flex flex-col items-center gap-2">
                  <button
                    onClick={() => setToolPanelOpen(true)}
                    className="p-1.5 bg-(--card) border border-(--border) rounded hover:bg-(--accent)"
                    title="Show tools"
                  >
                    <PanelRightOpen className="h-4 w-4 text-[#9a9590]" />
                    {(executingTools.size > 0 || thinkingActive) && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-(--success) rounded-full text-[9px] text-white font-medium">
                        {executingTools.size || "•"}
                      </span>
                    )}
                  </button>
                  <ContextIndicator
                    variant="icon"
                    stats={contextManager.stats}
                    config={contextManager.config}
                    onCompact={contextManager.compact}
                    onUpdateConfig={contextManager.updateConfig}
                    isWarning={contextManager.isWarning}
                    canSendMessage={contextManager.canSendMessage}
                    utilizationLevel={contextManager.utilizationLevel}
                  />
                </div>
              )}

              {!showEmptyState && <div className="shrink-0 pb-0 md:pb-3">{toolBelt}</div>}
            </div>

            {!isMobile && hasSidePanelContent && toolPanelOpen && (
              <ChatSidePanel
                isOpen={toolPanelOpen}
                onClose={() => setToolPanelOpen(false)}
                activePanel={activePanel}
                onSetActivePanel={setActivePanel}
                allToolCalls={allToolCalls}
                toolResultsMap={toolResultsMap}
                executingTools={executingTools}
                sessionArtifacts={sessionArtifacts}
                researchProgress={researchProgress}
                researchSources={researchSources}
                thinkingContent={thinkingState.content}
                thinkingActive={thinkingActive}
                activityItems={activityItems}
              />
            )}
          </div>
        </div>
      </div>

      {isMobile && mobileActionsOpen && lastAssistantMessage && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileActionsOpen(false)}
            aria-label="Close actions"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-(--card) border-t border-(--border) rounded-t-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#e8e4dd]">Message actions</span>
              <button
                onClick={() => setMobileActionsOpen(false)}
                className="p-1.5 rounded hover:bg-(--accent)"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  copyLastResponse();
                  setMobileActionsOpen(false);
                }}
                className="flex items-center justify-center rounded-lg border border-(--border) bg-(--background) p-2 text-[#c8c4bd] hover:bg-(--accent)"
                aria-label="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  toggleBookmark(lastAssistantMessage.id);
                  setMobileActionsOpen(false);
                }}
                className="flex items-center justify-center rounded-lg border border-(--border) bg-(--background) p-2 text-[#c8c4bd] hover:bg-(--accent)"
                aria-label="Bookmark"
              >
                {bookmarkedMessages.has(lastAssistantMessage.id) ? (
                  <BookmarkCheck className="h-4 w-4 text-(--link)" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  if (currentSessionId) {
                    forkAtMessage(lastAssistantMessage.id);
                    setMobileActionsOpen(false);
                  }
                }}
                disabled={!currentSessionId}
                className="flex items-center justify-center rounded-lg border border-(--border) bg-(--background) p-2 text-[#c8c4bd] hover:bg-(--accent) disabled:opacity-40 disabled:hover:bg-(--background)"
                aria-label="Fork"
              >
                <GitBranch className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1">
                <ContextIndicator
                  stats={contextManager.stats}
                  config={contextManager.config}
                  onCompact={contextManager.compact}
                  onUpdateConfig={contextManager.updateConfig}
                  isWarning={contextManager.isWarning}
                  canSendMessage={contextManager.canSendMessage}
                  utilizationLevel={contextManager.utilizationLevel}
                />
              </div>
              {sessionUsage && (
                <button
                  onClick={() => {
                    setUsageDetailsOpen(true);
                    setMobileActionsOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-(--border) text-[11px] text-[#9a9590] hover:bg-(--accent)"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Usage
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <UsageModal
        isOpen={usageDetailsOpen}
        onClose={() => setUsageDetailsOpen(false)}
        sessionUsage={sessionUsage}
        messages={messages}
        selectedModel={selectedModel}
      />
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onExportMarkdown={exportAsMarkdown}
        onExportJson={exportAsJson}
      />
      <MCPSettingsModal
        isOpen={mcpSettingsOpen}
        onClose={() => setMcpSettingsOpen(false)}
        servers={mcpServers}
        onServersChange={setMcpServers}
      />
      <ChatSettingsModal
        isOpen={chatSettingsOpen}
        onClose={() => setChatSettingsOpen(false)}
        systemPrompt={systemPrompt}
        onSystemPromptChange={(prompt) => {
          setSystemPrompt(prompt);
          saveSystemPrompt(prompt);
        }}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onSelectedModelChange={async (modelId) => {
          setSelectedModel((modelId || "").trim());
          if (currentSessionId) {
            try {
              await api.updateChatSession(currentSessionId, {
                model: modelId || undefined,
              });
              updateSessions((p) =>
                p.map((s) => (s.id === currentSessionId ? { ...s, model: modelId } : s)),
              );
            } catch {}
          }
        }}
        deepResearch={deepResearch}
        onDeepResearchChange={updateDeepResearch}
      />
    </>
  );
}

export default function ChatPage() {
  return (
    <MessageParsingProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse-soft">
              <Sparkles className="h-8 w-8 text-[#9a9590]" />
            </div>
          </div>
        }
      >
        <ChatPageContent />
      </Suspense>
    </MessageParsingProvider>
  );
}
