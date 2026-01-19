"use client";

import type { UIMessage } from "@ai-sdk/react";
import { Loader2 } from "lucide-react";
import { ChatMessageItem } from "./ChatMessageItem";

interface ChatMessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  error?: string | null;
  artifactsEnabled?: boolean;
}

export function ChatMessageList({ messages, isLoading, error, artifactsEnabled = false }: ChatMessageListProps) {
  const lastMessage = messages[messages.length - 1];
  const showLoadingIndicator = isLoading && lastMessage?.role === "user";

  return (
    <div className="flex flex-col gap-4 px-4 md:px-6 py-4 max-w-4xl mx-auto w-full">
      {messages.map((message, index) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
          artifactsEnabled={artifactsEnabled}
        />
      ))}
      {showLoadingIndicator && (
        <div className="flex items-center gap-2 text-[#9a9590]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating response...</span>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
