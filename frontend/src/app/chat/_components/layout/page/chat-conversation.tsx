// CRITICAL
"use client";

import { memo, useCallback, type ReactNode, type RefObject } from "react";
import type { AgentFileEntry, Artifact, ChatMessage } from "@/lib/types";
import { ChatMessageList } from "../../messages/chat-message-list";

interface ChatConversationProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamError?: string | null;
  onDismissStreamError?: () => void;
  agentMode?: boolean;
  executingToolsSize?: number;
  onOpenComputerPanel?: () => void;
  artifactsEnabled?: boolean;
  artifactsByMessage?: Map<string, Artifact[]>;
  selectedModel?: string;
  contextUsageLabel?: string | null;
  agentFiles?: AgentFileEntry[];
  onOpenAgentFile?: (path: string) => void;
  currentSessionId?: string | null;
  agentFilesBrowsePath?: string;
  onFork?: (messageId: string) => void;
  onReprompt?: (messageId: string) => void;
  onListen?: (messageId: string) => void;
  listeningMessageId?: string | null;
  listeningPending?: boolean;
  onOpenContext?: () => void;
  runStatusLine?: string;
  showEmptyState: boolean;
  toolBelt: ReactNode;
  onScroll: () => void;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

function ChatConversationBase({
  messages,
  isLoading,
  streamError,
  onDismissStreamError,
  agentMode,
  executingToolsSize = 0,
  onOpenComputerPanel,
  artifactsEnabled,
  artifactsByMessage,
  selectedModel,
  contextUsageLabel,
  agentFiles,
  onOpenAgentFile,
  currentSessionId,
  agentFilesBrowsePath = "",
  onFork,
  onReprompt,
  onListen,
  listeningMessageId,
  listeningPending,
  onOpenContext,
  runStatusLine,
  showEmptyState,
  toolBelt,
  onScroll,
  messagesContainerRef,
  messagesEndRef,
}: ChatConversationProps) {
  const showComputerHint =
    Boolean(agentMode && onOpenComputerPanel && (isLoading || executingToolsSize > 0));

  const handleEmptyStateScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      messagesContainerRef.current = node;
    },
    [messagesContainerRef],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {(streamError || showComputerHint) && (
        <div className="shrink-0 space-y-2 border-b border-(--border-subtle) bg-(--surface-raised) px-3 py-2">
          {streamError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-(--fg)">
              <span className="min-w-0 flex-1 leading-snug">{streamError}</span>
              {onDismissStreamError ? (
                <button
                  type="button"
                  onClick={onDismissStreamError}
                  className="shrink-0 rounded px-2 py-0.5 text-[12px] font-medium text-(--fg-muted) hover:bg-(--surface-overlay) hover:text-(--fg)"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          ) : null}
          {showComputerHint ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--border-subtle) bg-(--surface) px-3 py-2 text-[13px] text-(--fg-muted)">
              <span>Tools and workspace files are in Computer.</span>
              <button
                type="button"
                onClick={onOpenComputerPanel}
                className="shrink-0 rounded-md border border-(--border) bg-(--surface-overlay) px-2.5 py-1 text-[12px] font-semibold text-(--fg) hover:bg-(--surface-muted)"
              >
                Open Computer
              </button>
            </div>
          ) : null}
        </div>
      )}
      {showEmptyState ? (
        <div
          ref={handleEmptyStateScrollRef}
          onScroll={onScroll}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden chat-scroll-pad flex flex-col"
        >
          <div className="h-full flex items-center justify-center px-4 md:px-6 py-10">
            <div className="w-full max-w-2xl">
              <div className="hidden md:block">{toolBelt}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 w-full flex-1 flex-col justify-end">
            <ChatMessageList
              messages={messages}
              isLoading={isLoading}
              artifactsEnabled={artifactsEnabled}
              artifactsByMessage={artifactsByMessage}
              selectedModel={selectedModel}
              contextUsageLabel={contextUsageLabel}
              agentFiles={agentFiles}
              onOpenAgentFile={onOpenAgentFile}
              currentSessionId={currentSessionId}
              agentFilesBrowsePath={agentFilesBrowsePath}
              messagesContainerRef={messagesContainerRef}
              onScroll={onScroll}
              messagesEndRef={messagesEndRef}
              onFork={onFork}
              onReprompt={onReprompt}
              onListen={onListen}
              listeningMessageId={listeningMessageId}
              listeningPending={listeningPending}
              onOpenContext={onOpenContext}
              runStatusLine={runStatusLine}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const ChatConversation = memo(ChatConversationBase);
