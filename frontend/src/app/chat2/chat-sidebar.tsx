"use client";

import { Plus, X, Trash2 } from "lucide-react";

interface ChatSidebarProps {
  sessions: Array<{ id: string; title: string; created_at?: string }>;
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ChatSidebar({ sessions, currentSessionId, onSelect, onNew, onDelete, onClose }: ChatSidebarProps) {
  return (
    <div className="w-64 shrink-0 flex flex-col border-r border-(--border)/20 bg-(--bg) h-full">
      {/* Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-(--border)/20 shrink-0">
        <span className="text-xs font-medium text-(--dim) uppercase tracking-wider">History</span>
        <div className="flex items-center gap-1">
          <button onClick={onNew} className="p-1.5 rounded-md hover:bg-(--surface) transition-colors" title="New chat">
            <Plus className="w-3.5 h-3.5 text-(--dim)" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-(--surface) transition-colors" title="Close">
            <X className="w-3.5 h-3.5 text-(--dim)" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <p className="text-[11px] text-(--dim)/40 font-mono px-3 py-4">no sessions yet</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
              s.id === currentSessionId
                ? "bg-(--surface) text-(--fg)"
                : "text-(--dim) hover:bg-(--surface)/50 hover:text-(--fg)"
            }`}
            onClick={() => onSelect(s.id)}
          >
            <span className="text-[13px] flex-1 truncate">{s.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-(--surface) transition-all"
            >
              <Trash2 className="w-3 h-3 text-(--dim)/50 hover:text-(--err)" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
