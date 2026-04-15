// CRITICAL
"use client";

import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store";
import { ChatHistoryPanel } from "./chat-history-panel";

export interface ChatHistoryDockProps {
  onRefreshChatSessions: () => void;
  onActivateChatSession: (sessionId: string) => void | Promise<void>;
  onNewChatSession: () => void;
  onDeleteChatSession: (sessionId: string) => void | Promise<void>;
  onRenameChatSession: (sessionId: string, title: string) => void | Promise<void>;
  /** Desktop: collapse the history rail for more chat width. */
  onCollapseRail?: () => void;
}

/**
 * Subscribes to session list state locally so session list updates (rename, SSE, etc.)
 * do not re-render the full chat page / sidebar content maps.
 */
export const ChatHistoryDock = memo(function ChatHistoryDock({
  onRefreshChatSessions,
  onActivateChatSession,
  onNewChatSession,
  onDeleteChatSession,
  onRenameChatSession,
  onCollapseRail,
}: ChatHistoryDockProps) {
  const { sessions, sessionsLoading, currentSessionId } = useAppStore(
    useShallow((s) => ({
      sessions: s.sessions,
      sessionsLoading: s.sessionsLoading,
      currentSessionId: s.currentSessionId,
    })),
  );

  return (
    <ChatHistoryPanel
      sessions={sessions}
      sessionsLoading={sessionsLoading}
      currentSessionId={currentSessionId}
      onRefresh={onRefreshChatSessions}
      onSelectSession={onActivateChatSession}
      onNewChat={onNewChatSession}
      onDeleteSession={onDeleteChatSession}
      onRenameSession={onRenameChatSession}
      onCollapseRail={onCollapseRail}
    />
  );
});
