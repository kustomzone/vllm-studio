// CRITICAL
"use client";

import { memo, useCallback, useState, type ReactNode, type RefObject } from "react";
import type { AgentFileEntry, Artifact, ChatMessage } from "@/lib/types";
import { ChatMessageList } from "../../messages/chat-message-list";

interface ChatConversationProps {
  messages: ChatMessage[];
  isLoading: boolean;
  artifactsEnabled?: boolean;
  artifactsByMessage?: Map<string, Artifact[]>;
  selectedModel?: string;
  contextUsageLabel?: string | null;
  agentFiles?: AgentFileEntry[];
  selectedAgentFilePath?: string | null;
  onOpenAgentFile?: (path: string) => void;
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
  artifactsEnabled,
  artifactsByMessage,
  selectedModel,
  contextUsageLabel,
  agentFiles,
  selectedAgentFilePath,
  onOpenAgentFile,
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
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      messagesContainerRef.current = node;
      setScrollParent(node);
    },
    [messagesContainerRef],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <div
        ref={handleRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll-pad"
      >
        {showEmptyState ? (
          <div className="h-full flex items-center justify-center px-4 md:px-6 py-10">
            <div className="w-full max-w-2xl">
              <div className="hidden md:block">{toolBelt}</div>
            </div>
          </div>
        ) : (
          <div className="min-h-full flex flex-col">
            <div className="flex-1" />
            <ChatMessageList
              messages={messages}
              isLoading={isLoading}
              artifactsEnabled={artifactsEnabled}
              artifactsByMessage={artifactsByMessage}
              selectedModel={selectedModel}
              contextUsageLabel={contextUsageLabel}
              agentFiles={agentFiles}
              selectedAgentFilePath={selectedAgentFilePath}
              onOpenAgentFile={onOpenAgentFile}
              scrollParent={scrollParent}
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
        )}
      </div>
    </div>
  );
}

export const ChatConversation = memo(ChatConversationBase);
