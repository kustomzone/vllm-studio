'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ChatSession } from '@/lib/types';

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isLoading?: boolean;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isCollapsed,
  onToggleCollapse,
  isLoading,
}: ChatSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (isCollapsed) {
    return (
      <div className="w-8 h-full border-r border-[var(--border)] flex flex-col items-center py-2 gap-0.5">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-[var(--accent)] transition-colors"
          title="Expand"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            console.log('New chat clicked (collapsed)');
            onNewSession();
          }}
          className="p-1.5 rounded hover:bg-[var(--accent)] transition-colors"
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-44 h-full border-r border-[var(--border)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)]">
        <button
          onClick={() => {
            console.log('New chat clicked');
            onNewSession();
          }}
          className="flex items-center gap-1 text-xs hover:text-[var(--foreground)] hover:bg-[var(--accent)] px-2 py-1 rounded transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New</span>
        </button>
        <button
          onClick={onToggleCollapse}
          className="p-0.5 rounded hover:bg-[var(--accent)] transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="flex gap-1">
              <span className="w-1 h-1 rounded-full bg-[var(--muted)] animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-[var(--muted)] animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-[var(--muted)] animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4 text-xs text-[var(--muted)]">
            No chats
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`group relative mx-1 mb-0.5 rounded cursor-pointer ${
                currentSessionId === session.id
                  ? 'bg-[var(--accent)]'
                  : 'hover:bg-[var(--accent)]/50'
              }`}
            >
              <button
                onClick={() => onSelectSession(session.id)}
                className="w-full px-2 py-1 text-left"
              >
                <span className="text-xs truncate block">{session.title}</span>
              </button>

              {hoveredId === session.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--error)]/20 text-[var(--muted)] hover:text-[var(--error)] transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
