"use client";

import { Sparkles } from "lucide-react";

interface ChatWelcomeProps {
  onNewChat: () => void;
}

export function ChatWelcome({ onNewChat }: ChatWelcomeProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-(--surface) border border-(--border)/50 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-(--dim)" />
          </div>
        </div>
        <h2 className="text-lg font-medium text-(--fg) mb-1">vLLM Studio Chat</h2>
        <p className="text-[13px] text-(--dim) mb-6 leading-relaxed">
          Send a message to start a conversation with your model.
        </p>
        <button
          onClick={onNewChat}
          className="px-5 py-2 text-sm font-medium bg-(--fg) text-(--bg) rounded-lg hover:opacity-90 transition-opacity"
        >
          New Chat
        </button>
      </div>
    </div>
  );
}
