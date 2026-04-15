// CRITICAL
"use client";

import { Loader2, PanelLeftClose, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { ChatSession } from "@/lib/types";

export interface ChatHistoryPanelProps {
  sessions: ChatSession[];
  sessionsLoading: boolean;
  currentSessionId: string | null;
  onRefresh: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void | Promise<void>;
  onRenameSession: (sessionId: string, title: string) => void | Promise<void>;
  onCollapseRail?: () => void;
}

function formatSessionWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

export const ChatHistoryPanel = memo(function ChatHistoryPanel({
  sessions,
  sessionsLoading,
  currentSessionId,
  onRefresh,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onCollapseRail,
}: ChatHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const editingIdRef = useRef<string | null>(null);
  const draftTitleRef = useRef("");
  const sessionsRef = useRef(sessions);
  const renameInFlightRef = useRef(false);

  sessionsRef.current = sessions;
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);
  useEffect(() => {
    draftTitleRef.current = draftTitle;
  }, [draftTitle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...sessions];
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    if (!q) return list;
    return list.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const beginRename = useCallback((s: ChatSession, e: MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setDraftTitle(s.title);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setDraftTitle("");
  }, []);

  const flushRename = useCallback(async () => {
    if (renameInFlightRef.current) return;
    const id = editingIdRef.current;
    if (!id) return;
    const next = draftTitleRef.current.trim();
    if (!next) {
      cancelRename();
      return;
    }
    const prevTitle = sessionsRef.current.find((s) => s.id === id)?.title;
    if (prevTitle === next) {
      cancelRename();
      return;
    }
    renameInFlightRef.current = true;
    try {
      await onRenameSession(id, next);
    } finally {
      renameInFlightRef.current = false;
    }
    cancelRename();
  }, [cancelRename, onRenameSession]);

  const onEditingBlur = useCallback(() => {
    queueMicrotask(() => {
      void flushRename();
    });
  }, [flushRename]);

  const onDraftKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void flushRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, flushRename],
  );

  const handleDelete = useCallback(
    async (sessionId: string, e: MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("Delete this chat? This cannot be undone.")) return;
      await onDeleteSession(sessionId);
    },
    [onDeleteSession],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-(--border)/40 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNewChat()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--border)/40 bg-(--surface)/40 px-2 py-1.5 text-[12px] font-medium text-(--fg) transition-colors hover:bg-(--fg)/[0.06]"
            title="Start a new chat"
          >
            <Plus className="h-3.5 w-3.5 text-(--dim)" />
            New chat
          </button>
          <button
            type="button"
            onClick={() => onRefresh()}
            disabled={sessionsLoading}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-(--border)/40 p-1.5 text-(--dim) transition-colors hover:bg-(--fg)/[0.06] hover:text-(--fg) disabled:opacity-40"
            title="Reload list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? "animate-spin" : ""}`} />
          </button>
          {onCollapseRail ? (
            <button
              type="button"
              onClick={() => onCollapseRail()}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-(--border)/40 p-1.5 text-(--dim) transition-colors hover:bg-(--fg)/[0.06] hover:text-(--fg)"
              title="Hide chat list (expand canvas)"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--dim)/60" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="w-full rounded-lg border border-(--border)/40 bg-(--bg) py-1.5 pl-8 pr-2 text-[12px] text-(--fg) placeholder:text-(--dim)/50 outline-none focus:border-(--hl2)/50"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sessionsLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-(--dim)">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-(--dim)/70">
            {query.trim() ? "No chats match your search." : "No saved chats yet."}
          </p>
        ) : (
          <ul className="py-1">
            {filtered.map((s) => {
              const active = s.id === currentSessionId;
              return (
                <li key={s.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void onSelectSession(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void onSelectSession(s.id);
                      }
                    }}
                    className={`group flex cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-(--surface) text-(--fg)" : "text-(--dim) hover:bg-(--fg)/[0.04] hover:text-(--fg)"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {editingId === s.id ? (
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={onDraftKeyDown}
                          onBlur={onEditingBlur}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded border border-(--hl2)/40 bg-(--bg) px-1.5 py-0.5 text-[13px] text-(--fg) outline-none"
                        />
                      ) : (
                        <span className="line-clamp-2 text-[13px] font-medium leading-snug">{s.title}</span>
                      )}
                      <div className="mt-0.5 text-[10px] text-(--dim)/60">{formatSessionWhen(s.updated_at)}</div>
                    </div>
                    {editingId !== s.id && (
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          title="Rename"
                          onClick={(e) => beginRename(s, e)}
                          className="rounded p-1 text-(--dim) hover:bg-(--fg)/[0.08] hover:text-(--fg)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={(e) => void handleDelete(s.id, e)}
                          className="rounded p-1 text-(--dim) hover:bg-(--err)/15 hover:text-(--err)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
});
