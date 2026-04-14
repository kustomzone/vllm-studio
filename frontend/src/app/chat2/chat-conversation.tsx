"use client";

import { useCallback, useRef } from "react";
import type { ChatController } from "./hooks/use-chat-controller";
import { MessageList } from "./messages/message-list";
import { ChatComposer } from "./chat-composer";

interface ChatConversationProps {
  ctrl: ChatController;
}

export function ChatConversation({ ctrl }: ChatConversationProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || ctrl.isLoading) return;
      void ctrl.sendMessage(text);
    },
    [ctrl],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <MessageList
        messages={ctrl.messages}
        isLoading={ctrl.isLoading}
        executingTools={ctrl.executingTools}
        toolResultsMap={ctrl.toolResultsMap}
        onToolClick={ctrl.focusToolCall}
      />

      {/* Composer */}
      <ChatComposer
        isLoading={ctrl.isLoading}
        selectedModel={ctrl.selectedModel}
        onSend={handleSend}
        inputRef={inputRef}
      />
    </div>
  );
}
