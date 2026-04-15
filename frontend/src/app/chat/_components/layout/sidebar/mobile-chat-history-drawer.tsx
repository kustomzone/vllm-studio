// CRITICAL
"use client";

import { memo, useCallback, useEffect } from "react";
import { PanelLeftClose } from "lucide-react";
import { ChatHistoryDock } from "./chat-side-panel/chat-history-dock";

export interface MobileChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void | Promise<void>;
  onRefreshChatSessions: () => void;
  onNewChatSession: () => void;
  onDeleteChatSession: (sessionId: string) => void | Promise<void>;
  onRenameChatSession: (sessionId: string, title: string) => void | Promise<void>;
}

export const MobileChatHistoryDrawer = memo(function MobileChatHistoryDrawer({
  isOpen,
  onClose,
  onSelectSession,
  onRefreshChatSessions,
  onNewChatSession,
  onDeleteChatSession,
  onRenameChatSession,
}: MobileChatHistoryDrawerProps) {
  const handleSelect = useCallback(
    async (sessionId: string) => {
      await onSelectSession(sessionId);
      onClose();
    },
    [onClose, onSelectSession],
  );

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <div className="md:hidden">
      <div
        className={`fixed inset-0 z-[35] bg-black/55 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <div
        className={`fixed inset-y-0 left-0 z-[36] flex w-[min(100%,320px)] max-w-[90vw] flex-col border-r border-(--border) bg-(--bg) shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-(--border)/40 px-2 py-2">
          <span className="px-1 text-[11px] font-medium uppercase tracking-wider text-(--dim)">Chats</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-(--dim) transition-colors hover:bg-(--fg)/[0.06] hover:text-(--fg)"
            title="Close"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatHistoryDock
            onRefreshChatSessions={onRefreshChatSessions}
            onActivateChatSession={handleSelect}
            onNewChatSession={onNewChatSession}
            onDeleteChatSession={onDeleteChatSession}
            onRenameChatSession={onRenameChatSession}
          />
        </div>
      </div>
    </div>
  );
});
