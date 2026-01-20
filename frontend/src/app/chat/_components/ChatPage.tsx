"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PanelRightOpen, Settings, BarChart3, Download, Server } from "lucide-react";
import { api } from "@/lib/api";
import { ToolBelt, type Attachment } from "@/components/chat/tool-belt";
import { ChatMessageList } from "./ChatMessageList";
import { ChatSidePanel } from "./ChatSidePanel";
import { ChatSplashCanvas } from "./ChatSplashCanvas";
import { ChatSettingsModal } from "./ChatSettingsModal";
import { MCPSettingsModal } from "./MCPSettingsModal";
import { UsageModal } from "./UsageModal";
import { ExportModal } from "./ExportModal";
import { useChatSessions } from "../hooks/useChatSessions";
import { useChatTools } from "../hooks/useChatTools";
import { useChatUsage } from "../hooks/useChatUsage";
import { useChatDerived } from "../hooks/useChatDerived";
import { useChatTransport } from "../hooks/useChatTransport";
import type { ActivePanel, DeepResearchConfig, SessionUsage } from "../types";
import type { UIMessage } from "@ai-sdk/react";

export function ChatPage() {
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get("session");
  const newChatFromUrl = searchParams.get("new") === "1";

  // Local UI state
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [toolPanelOpen, setToolPanelOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [artifactsEnabled, setArtifactsEnabled] = useState(false);
  const [deepResearch, setDeepResearch] = useState<DeepResearchConfig>({
    enabled: false,
    maxSources: 10,
    searchDepth: "medium",
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [streamingStartTime, setStreamingStartTime] = useState<number | null>(null);
  const [queuedContext, setQueuedContext] = useState("");
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mcpSettingsOpen, setMcpSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<
    Array<{ id: string; name?: string; path?: string }>
  >([]);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Sessions hook
  const {
    currentSessionId,
    currentSessionTitle,
    loadSessions,
    loadSession,
    startNewSession,
    setCurrentSessionId,
    setCurrentSessionTitle,
  } = useChatSessions();

  // Tools hook
  const {
    mcpServers,
    loadMCPServers,
    loadMCPTools,
    getToolDefinitions,
    executeTool,
    executingTools,
    toolResultsMap,
    setMcpServers,
  } = useChatTools({ mcpEnabled });

  // Usage hook
  const { refreshUsage } = useChatUsage({ setSessionUsage });

  // Transport hook for persistence
  const { persistMessage, createSessionWithMessage, generateTitle } = useChatTransport({
    currentSessionId,
    setCurrentSessionId,
    setCurrentSessionTitle,
    selectedModel,
  });

  // Track the last user input for title generation
  const lastUserInputRef = useRef<string>("");

  // Keep request config current for AI SDK transport (prevents stale model/tools)
  const requestConfigRef = useRef({
    model: selectedModel,
    systemPrompt,
    getToolDefinitions,
  });

  useEffect(() => {
    requestConfigRef.current = {
      model: selectedModel,
      systemPrompt,
      getToolDefinitions,
    };
  }, [selectedModel, systemPrompt, getToolDefinitions]);

  // Create transport for useChat (body resolved at request time)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const { model, systemPrompt, getToolDefinitions } = requestConfigRef.current;
          return {
            model: model || undefined,
            system: systemPrompt?.trim() ? systemPrompt.trim() : undefined,
            tools: getToolDefinitions?.() ?? [],
          };
        },
      }),
    [requestConfigRef],
  );

  // AI SDK useChat - the source of truth for messages
  const { messages, sendMessage, stop, status, error, setMessages } = useChat({
    transport,
    onToolCall: async ({ toolCall }) => {
      await executeTool({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: (toolCall as { input?: unknown }).input as Record<string, unknown>,
      });
    },
    onFinish: async ({ message }) => {
      setStreamingStartTime(null);
      setElapsedSeconds(0);

      // Persist assistant message
      if (currentSessionId && message.role === "assistant") {
        await persistMessage(currentSessionId, message);

        // Generate title if this is the first exchange
        if (currentSessionTitle === "New Chat" && lastUserInputRef.current) {
          const textContent = message.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("");
          await generateTitle(currentSessionId, lastUserInputRef.current, textContent);
        }
      }
    },
    onError: (err) => {
      console.error("Chat error:", err);
      setStreamingStartTime(null);
      setElapsedSeconds(0);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Derived state from messages
  const { thinkingState, thinkingActive, activityItems, hasSidePanelContent } = useChatDerived({
    messages,
    isLoading,
    executingTools,
    toolResultsMap,
  });

  const showEmptyState = messages.length === 0 && !isLoading && !error;

  // Scroll handling
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setUserScrolledUp(distanceFromBottom >= 160);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({
        behavior: isLoading ? "auto" : "smooth",
      });
    }
  }, [isLoading, messages, userScrolledUp]);

  // Elapsed time timer
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
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
  }, [isLoading, streamingStartTime]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle URL session/new params
  useEffect(() => {
    if (newChatFromUrl) {
      startNewSession();
      setMessages([]);
      return;
    }
    if (sessionFromUrl) {
      loadSession(sessionFromUrl).then((loadedMessages) => {
        if (loadedMessages) {
          setMessages(loadedMessages);
        }
      });
    }
  }, [newChatFromUrl, sessionFromUrl, startNewSession, loadSession, setMessages]);

  // Load MCP tools when enabled
  useEffect(() => {
    if (mcpEnabled) {
      loadMCPTools();
    }
  }, [mcpEnabled, loadMCPTools]);

  // Load available models from recipes on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const data = await api.getRecipes();
        // Map recipes to model options - ONLY use served_model_name
        const mappedModels = (data.recipes || [])
          .filter((recipe) => recipe.served_model_name) // Only recipes with served_model_name
          .map((recipe) => ({
            id: recipe.served_model_name!,
            name: recipe.served_model_name!,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setAvailableModels(mappedModels);

        // Try to restore last used model from localStorage
        const lastModel = localStorage.getItem("vllm-studio-last-model");
        const fallbackModel = mappedModels[0]?.id || "";

        setSelectedModel((current) => {
          let next = current;
          if (lastModel && mappedModels.some((m) => m.id === lastModel)) {
            next = lastModel;
          } else if (!current || !mappedModels.some((m) => m.id === current)) {
            // Auto-select first model if none selected or selection is invalid
            next = fallbackModel;
          }

          if (next && next !== current) {
            localStorage.setItem("vllm-studio-last-model", next);
          }

          return next;
        });
      } catch (err) {
        console.error("Failed to load models:", err);
      }
    };
    loadModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load MCP servers when settings modal opens
  useEffect(() => {
    if (mcpSettingsOpen) {
      loadMCPServers();
    }
  }, [mcpSettingsOpen, loadMCPServers]);

  // Refresh usage when modal opens
  useEffect(() => {
    if (usageOpen && currentSessionId) {
      refreshUsage(currentSessionId);
    }
  }, [usageOpen, currentSessionId, refreshUsage]);

  // Export functions
  const handleExportJson = useCallback(() => {
    const data = {
      title: currentSessionTitle,
      sessionId: currentSessionId,
      model: selectedModel,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
      })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${currentSessionId || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSessionId, currentSessionTitle, selectedModel, messages]);

  const handleExportMarkdown = useCallback(() => {
    let md = `# ${currentSessionTitle}\n\n`;
    md += `Model: ${selectedModel}\n`;
    md += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

    for (const msg of messages) {
      const role = msg.role === "user" ? "**User**" : "**Assistant**";
      md += `${role}:\n\n`;
      for (const part of msg.parts) {
        if (part.type === "text") {
          md += `${(part as { text: string }).text}\n\n`;
        } else if (part.type.startsWith("tool-") && "toolCallId" in part) {
          md += `> Tool: ${part.type.replace(/^tool-/, "")}\n\n`;
        }
      }
      md += "---\n\n";
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${currentSessionId || "export"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentSessionId, currentSessionTitle, selectedModel, messages]);

  // Handle send with persistence and attachments
  const handleSend = useCallback(
    async (attachments?: Attachment[]) => {
      if (!selectedModel) return;
      if (!input.trim() && (!attachments || attachments.length === 0)) return;
      if (isLoading) return;

      setStreamingStartTime(Date.now());
      const userInput = input;
      setInput("");

      // Store for title generation
      lastUserInputRef.current = userInput;

      // Build message parts including attachments
      const parts: UIMessage["parts"] = [];
      if (userInput.trim()) {
        parts.push({ type: "text", text: userInput });
      }

      // Add image attachments as file parts
      if (attachments) {
        for (const att of attachments) {
          if (att.type === "image" && att.base64) {
            // Note: AI SDK supports image parts, add as experimental_attachments in sendMessage
            parts.push({
              type: "text",
              text: `[Image: ${att.name}]`,
            });
          } else if (att.type === "file" && att.file) {
            // For files, add file name reference
            parts.push({
              type: "text",
              text: `[File: ${att.name}]`,
            });
          }
        }
      }

      const userMessage: UIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts,
      };

      // Create session if needed, then persist user message
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createSessionWithMessage(userMessage);
      } else {
        await persistMessage(sessionId, userMessage);
      }

      // Send the message via AI SDK - use simple text format
      // Note: For image attachments, the files would need to be passed as FileList
      // but our current attachment handling uses base64. For now, just send text.
      sendMessage({
        text: userInput,
      });
    },
    [
      input,
      isLoading,
      sendMessage,
      currentSessionId,
      createSessionWithMessage,
      persistMessage,
      selectedModel,
    ],
  );

  // Handle stop
  const handleStop = useCallback(() => {
    stop();
    setStreamingStartTime(null);
    setElapsedSeconds(0);
  }, [stop]);

  // Handle model change and persist to localStorage
  const handleModelChange = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      requestConfigRef.current = { ...requestConfigRef.current, model: modelId };
      localStorage.setItem("vllm-studio-last-model", modelId);
    },
    [requestConfigRef],
  );

  const toolBelt = (
    <ToolBelt
      value={input}
      onChange={setInput}
      onSubmit={handleSend}
      onStop={handleStop}
      disabled={!selectedModel}
      isLoading={isLoading}
      placeholder={selectedModel ? "Message..." : "Select a model"}
      selectedModel={selectedModel}
      availableModels={availableModels}
      onModelChange={handleModelChange}
      mcpEnabled={mcpEnabled}
      onMcpToggle={() => setMcpEnabled(!mcpEnabled)}
      artifactsEnabled={artifactsEnabled}
      onArtifactsToggle={() => setArtifactsEnabled(!artifactsEnabled)}
      deepResearchEnabled={deepResearch.enabled}
      onDeepResearchToggle={() => {
        const nextEnabled = !deepResearch.enabled;
        setDeepResearch({ ...deepResearch, enabled: nextEnabled });
        if (nextEnabled && !mcpEnabled) setMcpEnabled(true);
      }}
      elapsedSeconds={elapsedSeconds}
      queuedContext={queuedContext}
      onQueuedContextChange={setQueuedContext}
      onOpenMcpSettings={() => setMcpSettingsOpen(true)}
      onOpenChatSettings={() => setSettingsOpen(true)}
      hasSystemPrompt={systemPrompt.trim().length > 0}
    />
  );

  return (
    <div className="relative h-full flex overflow-hidden w-full max-w-full">
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden">
        <div className="flex-1 flex overflow-hidden relative min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col"
            >
              <div className="pb-0 md:pb-4 flex-1 flex flex-col">
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
                        isLoading={isLoading}
                        error={error?.message}
                        artifactsEnabled={artifactsEnabled}
                      />
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Side panel toggle + modal buttons (hidden on mobile) */}
            <div className="absolute right-3 top-3 z-10 hidden md:flex flex-col items-center gap-2">
              <button
                onClick={() => setToolPanelOpen(true)}
                className="relative p-1.5 bg-[var(--card)] border border-[var(--border)] rounded hover:bg-[var(--accent)]"
                title="Show tools"
              >
                <PanelRightOpen className="h-4 w-4 text-[#9a9590]" />
                {(executingTools.size > 0 || thinkingActive) && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--success)] rounded-full text-[9px] text-white font-medium flex items-center justify-center">
                    {executingTools.size || "·"}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-1.5 bg-[var(--card)] border border-[var(--border)] rounded hover:bg-[var(--accent)]"
                title="Settings"
              >
                <Settings className="h-4 w-4 text-[#9a9590]" />
              </button>
              <button
                onClick={() => setMcpSettingsOpen(true)}
                className="p-1.5 bg-[var(--card)] border border-[var(--border)] rounded hover:bg-[var(--accent)]"
                title="MCP Servers"
              >
                <Server className="h-4 w-4 text-[#9a9590]" />
              </button>
              <button
                onClick={() => setUsageOpen(true)}
                className="p-1.5 bg-[var(--card)] border border-[var(--border)] rounded hover:bg-[var(--accent)]"
                title="Usage"
              >
                <BarChart3 className="h-4 w-4 text-[#9a9590]" />
              </button>
              <button
                onClick={() => setExportOpen(true)}
                className="p-1.5 bg-[var(--card)] border border-[var(--border)] rounded hover:bg-[var(--accent)]"
                title="Export"
              >
                <Download className="h-4 w-4 text-[#9a9590]" />
              </button>
            </div>

            {!showEmptyState && <div className="shrink-0 pb-0 md:pb-3">{toolBelt}</div>}
          </div>

          {/* Side panel */}
          {hasSidePanelContent && toolPanelOpen && (
            <ChatSidePanel
              isOpen={toolPanelOpen}
              onClose={() => setToolPanelOpen(false)}
              activePanel={activePanel}
              onSetActivePanel={setActivePanel}
              thinkingContent={thinkingState.content}
              thinkingActive={thinkingActive}
              activityItems={activityItems}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ChatSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        selectedModel={selectedModel}
        onSelectedModelChange={setSelectedModel}
        availableModels={availableModels}
        deepResearch={deepResearch}
        onDeepResearchChange={setDeepResearch}
      />

      <MCPSettingsModal
        isOpen={mcpSettingsOpen}
        onClose={() => setMcpSettingsOpen(false)}
        servers={mcpServers}
        onServersChange={setMcpServers}
        onRefresh={loadMCPServers}
      />

      <UsageModal
        isOpen={usageOpen}
        onClose={() => setUsageOpen(false)}
        sessionUsage={sessionUsage}
        messages={messages}
        selectedModel={selectedModel}
      />

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onExportJson={handleExportJson}
        onExportMarkdown={handleExportMarkdown}
      />
    </div>
  );
}
