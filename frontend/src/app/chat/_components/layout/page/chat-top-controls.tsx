"use client";

import { memo } from "react";
import { Menu, MessageSquare, Settings } from "lucide-react";

interface ChatTopControlsProps {
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
  /** Opens the mobile chat history drawer (desktop uses the left rail). */
  onOpenChats?: () => void;
}

function ChatTopControlsBase({ onOpenSidebar, onOpenSettings, onOpenChats }: ChatTopControlsProps) {
  return (
    <>
      <div className="fixed left-4 top-[calc(env(safe-area-inset-top,0)+16px)] z-20 flex flex-col gap-2 md:hidden">
        {onOpenChats ? (
          <button
            type="button"
            onClick={onOpenChats}
            className="p-2 rounded-lg hover:bg-(--accent) transition-colors"
            title="Chats"
          >
            <MessageSquare className="h-5 w-5 text-(--dim)" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="p-2 rounded-lg hover:bg-(--accent) transition-colors"
          title="Open navigation"
        >
          <Menu className="h-5 w-5 text-(--dim)" />
        </button>
      </div>
      <div className="fixed right-4 top-[calc(env(safe-area-inset-top,0)+16px)] z-20 md:hidden">
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-(--accent) transition-colors"
          title="Chat settings"
        >
          <Settings className="h-5 w-5 text-(--dim)" />
        </button>
      </div>
    </>
  );
}

function areChatTopControlsPropsEqual(prev: ChatTopControlsProps, next: ChatTopControlsProps): boolean {
  return (
    prev.onOpenSidebar === next.onOpenSidebar &&
    prev.onOpenSettings === next.onOpenSettings &&
    prev.onOpenChats === next.onOpenChats
  );
}

export const ChatTopControls = memo(ChatTopControlsBase, areChatTopControlsPropsEqual);
