"use client";

import { useCallback, useRef } from "react";
import type { ChatSession, ToolCall, ToolResult } from "@/lib/types";
import type { Attachment } from "@/components/chat";
import {
  parseSSEEvents,
  normalizeStoredMessage,
  type Message,
  type OpenAIMessage,
  type OpenAIContentPart,
} from "../utils";
import { api } from "@/lib/api";

interface UseChatStreamOptions {
  input: string;
  messages: Message[];
  selectedModel: string;
  runningModel: string | null;
  systemPrompt: string;
  mcpEnabled: boolean;
  mcpTools: Array<{
    server: string;
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  currentSessionId: string | null;
  sessionFromUrl: string | null;
  currentSessionTitle: string;
  updateMessages: (updater: (messages: Message[]) => Message[]) => void;
  setInput: (value: string) => void;
  setIsLoading: (value: boolean) => void;
  setStreamingStartTime: (value: number | null) => void;
  setElapsedSeconds: (value: number) => void;
  setError: (value: string | null) => void;
  setCurrentSessionId: (value: string | null) => void;
  setCurrentSessionTitle: (value: string) => void;
  setTitleDraft: (value: string) => void;
  updateToolResultsMap: (
    updater: (map: Map<string, ToolResult>) => Map<string, ToolResult>,
  ) => void;
  updateSessions: (updater: (sessions: ChatSession[]) => ChatSession[]) => void;
  setSessionsAvailable: (value: boolean) => void;
  updateExecutingTools: (updater: (tools: Set<string>) => Set<string>) => void;
  refreshUsage: (sessionId: string) => void;
  bumpSessionUpdatedAt: (sessionId: string | null) => void;
  parseThinking: (content: string) => { mainContent: string };
  getOpenAITools: () => Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  executeMCPTool: (toolCall: ToolCall) => Promise<ToolResult>;
  loadingSessionRef: React.MutableRefObject<boolean>;
  activeSessionRef: React.MutableRefObject<string | null>;
}

export function useChatStream({
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
}: UseChatStreamOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const buildAPIMessages = useCallback(
    (msgs: Message[]): OpenAIMessage[] => {
      const apiMessages: OpenAIMessage[] = [];
      const sysContent = systemPrompt.trim();
      if (sysContent) apiMessages.push({ role: "system", content: sysContent });
      if (mcpEnabled && mcpTools.length > 0) {
        const toolsList = mcpTools
          .map((tool) => `- ${tool.server}__${tool.name}: ${tool.description || "No description"}`)
          .join("\n");
        apiMessages.push({
          role: "system",
          content: `Available tools:\n${toolsList}`,
        });
      }
      for (const msg of msgs) {
        if (msg.role === "user") {
          const parts: OpenAIContentPart[] = [];
          if (msg.content) parts.push({ type: "text", text: msg.content });
          if (msg.images?.length)
            msg.images.forEach((img) =>
              parts.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${img}` },
              }),
            );
          apiMessages.push({
            role: "user",
            content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
          });
        } else {
          const cleanContent = parseThinking(msg.content).mainContent;
          if (msg.toolCalls?.length) {
            apiMessages.push({
              role: "assistant",
              content: cleanContent || null,
              tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              })),
            });
            msg.toolResults?.forEach((tr) =>
              apiMessages.push({
                role: "tool",
                tool_call_id: tr.tool_call_id,
                content: tr.content,
              }),
            );
          } else {
            apiMessages.push({ role: "assistant", content: cleanContent || "" });
          }
        }
      }
      return apiMessages;
    },
    [mcpEnabled, mcpTools, parseThinking, systemPrompt],
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (attachments?: Attachment[]) => {
      const hasText = input.trim().length > 0;
      const hasAttachments = attachments?.length;
      const activeModelId = (selectedModel || runningModel || "").trim();
      if (
        (!hasText && !hasAttachments) ||
        !activeModelId ||
        loadingSessionRef.current ||
        abortControllerRef.current
      )
        return;
      const userContent = input.trim();
      const imageAttachments = attachments?.filter((a) => a.type === "image" && a.base64) || [];
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: userContent || (imageAttachments.length ? "[Image]" : "..."),
        images: imageAttachments.map((a) => a.base64!),
        model: activeModelId,
      };
      updateMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setStreamingStartTime(Date.now());
      setElapsedSeconds(0);
      setError(null);
      abortControllerRef.current = new AbortController();
      const conversationMessages = buildAPIMessages([...messages, userMessage]);
      let sessionId = currentSessionId || sessionFromUrl || activeSessionRef.current || null;
      if (sessionFromUrl && !currentSessionId) setCurrentSessionId(sessionFromUrl);
      let finalAssistantContent = "";

      try {
        if (!sessionId) {
          try {
            const { session } = await api.createChatSession({
              title: "New Chat",
              model: activeModelId || undefined,
            });
            sessionId = session.id;
            setCurrentSessionId(sessionId);
            updateSessions((prev) => [session, ...prev]);
            setSessionsAvailable(true);
          } catch {}
        }
        if (sessionId) {
          try {
            const persisted = await api.addChatMessage(sessionId, {
              id: userMessage.id,
              role: "user",
              content: userContent,
              model: activeModelId,
            });
            const normalized = normalizeStoredMessage(persisted);
            updateMessages((prev) =>
              prev.map((m) => (m.id === normalized.id ? { ...m, ...normalized } : m)),
            );
            bumpSessionUpdatedAt(sessionId);
            refreshUsage(sessionId);
          } catch {}
        }

        let iteration = 0;
        const MAX_ITERATIONS = 25;
        const cachedToolResultsBySignature = new Map<string, Omit<ToolResult, "tool_call_id">>();
        while (iteration < MAX_ITERATIONS) {
          iteration++;
          const requestBody: Record<string, unknown> = {
            messages: conversationMessages,
            model: activeModelId,
            tools: getOpenAITools(),
          };
          if (activeModelId.toLowerCase().includes("minimax")) {
            requestBody.temperature = 1.0;
            requestBody.top_p = 0.95;
            requestBody.top_k = 40;
          }
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: abortControllerRef.current?.signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response body");
          const assistantMsgId = (Date.now() + iteration).toString();
          updateMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: "assistant",
              content: "",
              isStreaming: true,
              model: activeModelId,
            },
          ]);
          let iterationContent = "";
          let toolCalls: ToolCall[] = [];
          let pendingContent = "";
          let pendingToolCalls: ToolCall[] | null = null;
          let frameId: number | null = null;
          const flushAssistantUpdate = (force = false) => {
            const applyUpdate = () => {
              frameId = null;
              if (!pendingContent && !pendingToolCalls) return;
              updateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: pendingContent || iterationContent,
                        toolCalls: pendingToolCalls ?? m.toolCalls,
                      }
                    : m,
                ),
              );
              pendingContent = "";
              pendingToolCalls = null;
            };
            if (force) {
              if (frameId !== null) window.cancelAnimationFrame(frameId);
              applyUpdate();
              return;
            }
            if (frameId === null) frameId = window.requestAnimationFrame(applyUpdate);
          };
          for await (const event of parseSSEEvents(reader)) {
            if (event.type === "text" && event.content) {
              iterationContent += event.content;
              pendingContent = iterationContent;
              flushAssistantUpdate();
            } else if (event.type === "tool_calls" && event.tool_calls) {
              toolCalls = event.tool_calls as ToolCall[];
              pendingToolCalls = toolCalls;
              flushAssistantUpdate(true);
            } else if (event.type === "error") {
              throw new Error(event.error || "Stream error");
            }
          }
          flushAssistantUpdate(true);
          if (!toolCalls.length) {
            finalAssistantContent = iterationContent;
            updateMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m)),
            );
            if (sessionId) {
              try {
                const persisted = await api.addChatMessage(sessionId, {
                  id: assistantMsgId,
                  role: "assistant",
                  content: iterationContent,
                  model: activeModelId,
                });
                const normalized = normalizeStoredMessage(persisted);
                updateMessages((prev) =>
                  prev.map((m) => (m.id === normalized.id ? { ...m, ...normalized } : m)),
                );
                bumpSessionUpdatedAt(sessionId);
                refreshUsage(sessionId);
              } catch {}
            }
            break;
          }
          const toolResults: ToolResult[] = [];
          const toolNameByCallId = new Map<string, string>();
          for (const tc of toolCalls) {
            const signature = `${tc.function?.name}:${tc.function?.arguments}`;
            toolNameByCallId.set(tc.id, tc.function.name);
            if (cachedToolResultsBySignature.has(signature)) {
              const cached = cachedToolResultsBySignature.get(signature)!;
              toolResults.push({ tool_call_id: tc.id, ...cached });
              updateToolResultsMap((prev) => {
                const next = new Map(prev);
                next.set(tc.id, { tool_call_id: tc.id, ...cached });
                return next;
              });
              continue;
            }
            updateExecutingTools((prev) => {
              const next = new Set(prev);
              next.add(tc.id);
              return next;
            });
            const result = await executeMCPTool(tc);
            cachedToolResultsBySignature.set(signature, {
              content: result.content,
              isError: result.isError,
            });
            toolResults.push(result);
            updateToolResultsMap((prev) => {
              const next = new Map(prev);
              next.set(tc.id, result);
              return next;
            });
            updateExecutingTools((prev) => {
              const next = new Set(prev);
              next.delete(tc.id);
              return next;
            });
          }
          updateMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, toolResults, isStreaming: false } : m,
            ),
          );
          if (sessionId) {
            try {
              await api.addChatMessage(sessionId, {
                id: assistantMsgId,
                role: "assistant",
                content: iterationContent,
                model: activeModelId,
                tool_calls: toolCalls.map((tc) => ({
                  ...tc,
                  result: toolResults.find((r) => r.tool_call_id === tc.id) || null,
                })),
              });
              bumpSessionUpdatedAt(sessionId);
              refreshUsage(sessionId);
            } catch {}
          }
          const cleanedContent = parseThinking(iterationContent).mainContent;
          conversationMessages.push({
            role: "assistant",
            content: cleanedContent || null,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          });
          toolResults.forEach((r) =>
            conversationMessages.push({
              role: "tool",
              tool_call_id: r.tool_call_id,
              name: toolNameByCallId.get(r.tool_call_id),
              content: r.content,
            }),
          );
        }

        const shouldUpdateTitle =
          currentSessionTitle.trim() === "" || currentSessionTitle === "New Chat";
        if (sessionId && finalAssistantContent.trim() && (shouldUpdateTitle || !currentSessionId)) {
          const fallbackTitle = userContent.trim().split(/\s+/).slice(0, 6).join(" ");
          try {
            const res = await fetch("/api/title", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: activeModelId,
                user: userContent,
                assistant: finalAssistantContent,
              }),
            });
            let nextTitle = fallbackTitle;
            if (res.ok) {
              const data = await res.json();
              if (data.title && data.title !== "New Chat") {
                nextTitle = data.title;
              }
            }
            if (nextTitle) {
              await api.updateChatSession(sessionId, { title: nextTitle });
              updateSessions((prev) =>
                prev.map((s) => (s.id === sessionId ? { ...s, title: nextTitle } : s)),
              );
              setCurrentSessionTitle(nextTitle);
              setTitleDraft(nextTitle);
            }
          } catch {
            if (fallbackTitle) {
              try {
                await api.updateChatSession(sessionId, { title: fallbackTitle });
                updateSessions((prev) =>
                  prev.map((s) => (s.id === sessionId ? { ...s, title: fallbackTitle } : s)),
                );
                setCurrentSessionTitle(fallbackTitle);
                setTitleDraft(fallbackTitle);
              } catch {}
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          updateMessages((prev) => {
            const last = prev[prev.length - 1];
            return last?.role === "assistant"
              ? prev.map((m) => (m.id === last.id ? { ...m, isStreaming: false } : m))
              : prev;
          });
        } else {
          setError(err instanceof Error ? err.message : "Failed to send message");
          updateMessages((prev) =>
            prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content
              ? prev.slice(0, -1)
              : prev,
          );
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      activeSessionRef,
      buildAPIMessages,
      bumpSessionUpdatedAt,
      currentSessionId,
      currentSessionTitle,
      executeMCPTool,
      getOpenAITools,
      input,
      loadingSessionRef,
      messages,
      parseThinking,
      refreshUsage,
      runningModel,
      selectedModel,
      sessionFromUrl,
      setCurrentSessionId,
      setCurrentSessionTitle,
      setElapsedSeconds,
      setError,
      setInput,
      setIsLoading,
      setSessionsAvailable,
      setStreamingStartTime,
      setTitleDraft,
      updateToolResultsMap,
      updateExecutingTools,
      updateMessages,
      updateSessions,
    ],
  );

  return {
    sendMessage,
    stopGeneration,
  };
}
