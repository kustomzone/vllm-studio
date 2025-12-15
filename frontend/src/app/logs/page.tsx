'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, Search, RefreshCw, Calendar, Clock, Trash2, Download } from 'lucide-react';
import api from '@/lib/api';
import type { LogSession } from '@/lib/types';

export default function LogsPage() {
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadLogContent(selectedSession);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logContent, autoScroll]);

  const loadSessions = async () => {
    try {
      const data = await api.getLogSessions();
      setSessions(data.sessions || []);
      if (data.sessions?.length > 0 && !selectedSession) {
        setSelectedSession(data.sessions[0].id);
      }
    } catch (e) {
      console.error('Failed to load log sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLogContent = async (sessionId: string) => {
    setLoadingContent(true);
    try {
      const data = await api.getLogContent(sessionId);
      setLogContent(data.content || '');
    } catch (e) {
      console.error('Failed to load log content:', e);
      setLogContent('Failed to load log content');
    } finally {
      setLoadingContent(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this log session?')) return;
    try {
      await api.deleteLogSession(sessionId);
      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setLogContent('');
      }
      await loadSessions();
    } catch (e) {
      alert('Failed to delete session: ' + (e as Error).message);
    }
  };

  const downloadLog = () => {
    if (!selectedSession || !logContent) return;
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSession}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSessions = filter
    ? sessions.filter(s =>
        s.model?.toLowerCase().includes(filter.toLowerCase()) ||
        s.id.toLowerCase().includes(filter.toLowerCase())
      )
    : sessions;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const highlightLog = (content: string) => {
    return content.split('\n').map((line, i) => {
      let className = 'text-[var(--muted-foreground)]';
      if (line.includes('ERROR') || line.includes('error')) {
        className = 'text-[var(--error)]';
      } else if (line.includes('WARNING') || line.includes('warn')) {
        className = 'text-[var(--warning)]';
      } else if (line.includes('INFO')) {
        className = 'text-[var(--accent)]';
      } else if (line.includes('loaded') || line.includes('started') || line.includes('success')) {
        className = 'text-[var(--success)]';
      }
      return (
        <div key={i} className={`${className} hover:bg-[var(--card-hover)] px-2`}>
          {line || '\u00A0'}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sessions Sidebar */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-lg font-semibold mb-3">Log Sessions</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter sessions..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-[var(--muted-foreground)] text-sm">
              No log sessions found
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={`p-3 border-b border-[var(--border)] cursor-pointer transition-colors ${
                  selectedSession === session.id
                    ? 'bg-[var(--card-hover)]'
                    : 'hover:bg-[var(--card-hover)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {session.model || session.id}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted-foreground)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(session.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(session.created_at)}
                      </span>
                    </div>
                    {session.backend && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                        session.backend === 'vllm'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-purple-500/10 text-purple-400'
                      }`}>
                        {session.backend}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-1 text-[var(--muted-foreground)] hover:text-[var(--error)] transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
          {sessions.length} sessions total
        </div>
      </div>

      {/* Log Viewer */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--accent)]" />
                <span className="font-medium">{selectedSession}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded"
                  />
                  Auto-scroll
                </label>
                <button
                  onClick={() => loadLogContent(selectedSession)}
                  className="p-2 hover:bg-[var(--card-hover)] rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingContent ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={downloadLog}
                  className="p-2 hover:bg-[var(--card-hover)] rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={logRef}
              className="flex-1 overflow-auto p-4 font-mono text-xs bg-[var(--background)]"
            >
              {loadingContent ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-6 w-6 animate-spin text-[var(--muted)]" />
                </div>
              ) : logContent ? (
                highlightLog(logContent)
              ) : (
                <div className="text-center text-[var(--muted-foreground)]">
                  No log content available
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a log session to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
