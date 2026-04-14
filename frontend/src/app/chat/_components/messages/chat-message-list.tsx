// CRITICAL
"use client";

import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useMemo,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { Virtuoso } from "react-virtuoso";
import { ChatMessageItem } from "./chat-message-item";
import { PerfProfiler } from "../perf/perf-profiler";
import type { AgentFileEntry, Artifact, ChatMessage } from "@/lib/types";
import { filterVisibleMessages } from "./chat-message-list/visible-messages";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  artifactsEnabled?: boolean;
  artifactsByMessage?: Map<string, Artifact[]>;
  selectedModel?: string;
  contextUsageLabel?: string | null;
  agentFiles?: AgentFileEntry[];
  selectedAgentFilePath?: string | null;
  onOpenAgentFile?: (path: string) => void;
  scrollParent?: HTMLElement | null;
  messagesEndRef?: RefObject<HTMLDivElement | null>;
  onFork?: (messageId: string) => void;
  onReprompt?: (messageId: string) => void;
  onListen?: (messageId: string) => void;
  listeningMessageId?: string | null;
  listeningPending?: boolean;
  onOpenContext?: () => void;
  runStatusLine?: string;
}

interface VirtuosoItem {
  message: ChatMessage;
  idx: number;
}

const VirtuosoList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`flex flex-col min-h-full ${className ?? ""}`} {...props} />
  ),
);
VirtuosoList.displayName = "VirtuosoList";

export function ChatMessageList({
  messages,
  isLoading,
  artifactsEnabled = false,
  artifactsByMessage,
  selectedModel,
  contextUsageLabel,
  scrollParent,
  messagesEndRef,
  onFork,
  onReprompt,
  onListen,
  listeningMessageId,
  listeningPending,
  onOpenContext,
  runStatusLine,
}: ChatMessageListProps) {
  const lastRawId = messages[messages.length - 1]?.id;

  const visibleMessages = useMemo(
    () =>
      filterVisibleMessages({
        messages,
        isLoading,
        lastRawMessageId: lastRawId,
        artifactsByMessage,
      }),
    [artifactsByMessage, isLoading, lastRawId, messages],
  );

  const deferred = useDeferredValue(visibleMessages);
  const base = isLoading ? deferred : visibleMessages;

  // Build items, patching the last assistant message with live data during streaming
  const items = useMemo<VirtuosoItem[]>(() => {
    const out: VirtuosoItem[] = base.map((m, i) => ({ message: m, idx: i }));
    if (!isLoading) return out;
    const live = visibleMessages[visibleMessages.length - 1];
    if (!live || live.role !== "assistant") return out;
    const last = out[out.length - 1];
    if (last?.message.id === live.id) {
      return [...out.slice(0, -1), { ...last, message: live }];
    }
    return out;
  }, [base, isLoading, visibleMessages]);

  const handleExport = useCallback(
    (payload: {
      messageId: string;
      role: "user" | "assistant";
      content: string;
      model?: string;
      totalTokens?: number;
    }) => {
      if (!payload.content.trim()) return;
      const lines = [
        `# ${payload.role === "assistant" ? "Assistant" : "User"} Message`,
        payload.model ? `Model: ${payload.model}` : null,
        payload.totalTokens ? `Total tokens: ${payload.totalTokens}` : null,
        `Exported: ${new Date().toLocaleString()}`,
        "",
      ].filter(Boolean);
      const md = [...lines, payload.content].join("\n");
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `message-${payload.messageId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const renderItem = useCallback(
    (_index: number, item: VirtuosoItem) => (
      <ChatMessageItem
        key={item.message.id}
        message={item.message}
        isStreaming={
          isLoading && item.idx === visibleMessages.length - 1 && item.message.role === "assistant"
        }
        artifactsEnabled={artifactsEnabled}
        artifacts={artifactsByMessage?.get(item.message.id)}
        selectedModel={selectedModel}
        contextUsageLabel={contextUsageLabel}
        onOpenContext={onOpenContext}
        onFork={item.message.role === "assistant" ? onFork : undefined}
        onReprompt={item.message.role === "assistant" ? onReprompt : undefined}
        onListen={item.message.role === "assistant" ? onListen : undefined}
        isListening={item.message.id === listeningMessageId}
        isListenPending={item.message.id === listeningMessageId && Boolean(listeningPending)}
        onExport={handleExport}
      />
    ),
    [
      artifactsByMessage,
      artifactsEnabled,
      contextUsageLabel,
      handleExport,
      isLoading,
      onFork,
      onListen,
      onOpenContext,
      onReprompt,
      selectedModel,
      listeningMessageId,
      listeningPending,
      visibleMessages.length,
    ],
  );

  // Footer reserves constant space so messages never shift when loading state changes.
  const Footer = useCallback(
    () => (
      <div className="pt-1 pb-2">
        <div
          className="flex items-center gap-2.5 h-8 overflow-hidden transition-opacity duration-200 ease-out"
          style={{ opacity: isLoading ? 1 : 0 }}
        >
          <div className="typing-dots shrink-0">
            <span />
            <span />
            <span />
          </div>
          <span
            className="text-[11px] text-(--dim)/50 font-mono truncate transition-opacity duration-200"
            style={{ opacity: runStatusLine?.trim() ? 1 : 0 }}
          >
            {runStatusLine?.trim() || "\u00a0"}
          </span>
        </div>
        <div ref={messagesEndRef} />
      </div>
    ),
    [isLoading, messagesEndRef, runStatusLine],
  );

  const components = useMemo(() => ({ List: VirtuosoList, Footer }), [Footer]);
  const itemKey = useCallback((_i: number, item: VirtuosoItem) => item.message.id, []);

  return (
    <div className="px-4 md:px-6 py-3 max-w-3xl mx-auto w-full h-full">
      <PerfProfiler id="chat-message-list">
        <Virtuoso
          className="h-full"
          customScrollParent={scrollParent ?? undefined}
          data={items}
          itemContent={renderItem}
          components={components}
          computeItemKey={itemKey}
          initialTopMostItemIndex={items.length > 0 ? items.length - 1 : 0}
          alignToBottom
          followOutput="smooth"
        />
      </PerfProfiler>
    </div>
  );
}
