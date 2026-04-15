// CRITICAL
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
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
  onOpenAgentFile?: (path: string) => void;
  currentSessionId?: string | null;
  agentFilesBrowsePath?: string;
  /** Scroll surface for Virtuoso + useChatScroll (must be the element that actually scrolls). */
  messagesContainerRef: RefObject<HTMLDivElement | null>;
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
    <div
      ref={ref}
      className={`mx-auto flex w-full max-w-3xl flex-col px-4 md:px-6 ${className ?? ""}`}
      {...props}
    />
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
  agentFiles = [],
  onOpenAgentFile,
  currentSessionId,
  agentFilesBrowsePath = "",
  messagesContainerRef,
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

  const base = visibleMessages;

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
        currentSessionId={currentSessionId}
        agentFiles={agentFiles}
        agentFilesBrowsePath={agentFilesBrowsePath}
        onOpenAgentFile={onOpenAgentFile}
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
      agentFiles,
      agentFilesBrowsePath,
      currentSessionId,
      onOpenAgentFile,
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
      <div className="mx-auto w-full max-w-3xl px-4 pt-1 pb-2 md:px-6">
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

  /** `followOutput` only runs when item *count* changes; streaming grows the last item without that. */
  const streamingTailFingerprint = useMemo(() => {
    if (!isLoading) return "";
    const last = visibleMessages[visibleMessages.length - 1];
    if (!last) return `len:${visibleMessages.length}`;
    let textLen = 0;
    for (const p of last.parts ?? []) {
      if (!p || typeof p !== "object") continue;
      if (p.type === "text" && typeof p.text === "string") textLen += p.text.length;
      if (
        p.type === "reasoning" &&
        "text" in p &&
        typeof (p as { text?: unknown }).text === "string"
      ) {
        textLen += (p as { text: string }).text.length;
      }
    }
    return `${last.id}:${textLen}:${visibleMessages.length}`;
  }, [isLoading, visibleMessages]);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const didInitialTailScrollRef = useRef(false);
  const atBottomRef = useRef(true);

  const atBottomStateChange = useCallback((atBottom: boolean) => {
    atBottomRef.current = atBottom;
  }, []);

  useEffect(() => {
    didInitialTailScrollRef.current = false;
  }, [currentSessionId]);

  useEffect(() => {
    if (!isLoading || streamingTailFingerprint === "") return;
    const el = messagesContainerRef.current;
    const stuckAtTop = el != null && el.scrollHeight > el.clientHeight + 100 && el.scrollTop < 24;
    if (!atBottomRef.current && !stuckAtTop) return;
    const id = requestAnimationFrame(() => {
      virtuosoRef.current?.autoscrollToBottom();
    });
    return () => cancelAnimationFrame(id);
  }, [isLoading, messagesContainerRef, streamingTailFingerprint]);

  useLayoutEffect(() => {
    if (items.length === 0) {
      didInitialTailScrollRef.current = false;
      return;
    }
    if (didInitialTailScrollRef.current) return;

    let alive = true;
    let raf2 = 0;
    const id1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!alive) return;
        const v = virtuosoRef.current;
        if (!v || didInitialTailScrollRef.current) return;
        didInitialTailScrollRef.current = true;
        v.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" });
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [currentSessionId, items.length]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col py-3">
      <PerfProfiler id="chat-message-list">
        <Virtuoso
          ref={virtuosoRef}
          className="flex min-h-0 w-full flex-1 flex-col"
          data={items}
          itemContent={renderItem}
          components={components}
          scrollerRef={(node) => {
            messagesContainerRef.current =
              node && "scrollTop" in node ? (node as HTMLDivElement) : null;
          }}
          computeItemKey={itemKey}
          alignToBottom
          atBottomThreshold={200}
          atBottomStateChange={atBottomStateChange}
          followOutput
        />
      </PerfProfiler>
    </div>
  );
}
