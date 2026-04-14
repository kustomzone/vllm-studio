"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage, ToolResult } from "@/lib/types";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
  onToolClick: (toolCallId: string) => void;
}

export function MessageList({ messages, isLoading, executingTools, toolResultsMap, onToolClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages during streaming
  useEffect(() => {
    if (isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [isLoading, messages.length]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} message={msg} />
          ) : msg.role === "assistant" ? (
            <AssistantMessage
              key={msg.id}
              message={msg}
              executingTools={executingTools}
              toolResultsMap={toolResultsMap}
              onToolClick={onToolClick}
              isLoading={isLoading}
            />
          ) : null,
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
