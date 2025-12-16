'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  User,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Image as ImageIcon,
} from 'lucide-react';
import api from '@/lib/api';
import type { ChatSession } from '@/lib/types';
import { MessageRenderer, ChatSidebar, ToolBelt, MCPSettingsModal } from '@/components/chat';
import type { Attachment, MCPServerConfig } from '@/components/chat';

interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

interface TextContent {
  type: 'text';
  text: string;
}

type MessageContent = string | (TextContent | ImageContent)[];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 images for display
  isStreaming?: boolean;
}

interface APIMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
}

export default function ChatPage() {
  // Session state (optional - fails gracefully if backend doesn't support)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsAvailable, setSessionsAvailable] = useState(true);

  // Message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Model state
  const [runningModel, setRunningModel] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string>('');
  const [pageLoading, setPageLoading] = useState(true);

  // UI state
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // MCP & Artifacts state
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [artifactsEnabled, setArtifactsEnabled] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [mcpSettingsOpen, setMcpSettingsOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadStatus();
    loadSessions();
    loadMCPServers();
  }, []);

  const loadMCPServers = async () => {
    try {
      const servers = await api.getMCPServers();
      setMcpServers(servers.map(s => ({ ...s, env: (s as any).env || {} })));
    } catch (e) {
      console.log('MCP servers not available:', e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadStatus = async () => {
    try {
      const status = await api.getStatus();
      if (status.running_process) {
        const modelId =
          status.running_process.served_model_name ||
          status.matched_recipe?.served_model_name ||
          status.running_process.model_path ||
          'default';
        setRunningModel(modelId);
        setModelName(
          status.matched_recipe?.name ||
            status.running_process.model_path.split('/').pop() ||
            'Model'
        );
      }
    } catch (e) {
      console.error('Failed to load status:', e);
    } finally {
      setPageLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const data = await api.getChatSessions();
      setSessions(data.sessions);
    } catch (e) {
      // Sessions API not available - that's okay, we'll work without persistence
      console.log('Chat sessions API not available');
      setSessionsAvailable(false);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (!sessionsAvailable) return;
    try {
      const data = await api.getChatSession(sessionId);
      const loadedMessages: Message[] = data.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      setMessages(loadedMessages);
      setCurrentSessionId(sessionId);
    } catch (e) {
      console.error('Failed to load session:', e);
      setError('Failed to load conversation');
    }
  };

  const createSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    // Focus the input
    setTimeout(() => {
      const input = document.querySelector('textarea');
      input?.focus();
    }, 100);
  };

  const deleteSession = async (sessionId: string) => {
    if (!sessionsAvailable) return;
    try {
      await api.deleteChatSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const buildAPIMessages = (msgs: Message[]): APIMessage[] => {
    return msgs.map((m) => {
      // If message has images, use OpenAI vision format
      if (m.images && m.images.length > 0) {
        const content: (TextContent | ImageContent)[] = [];

        // Add text content
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }

        // Add images
        for (const base64 of m.images) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
            },
          });
        }

        return { role: m.role, content };
      }

      // Plain text message
      return { role: m.role, content: m.content };
    });
  };

  const sendMessage = async (attachments?: Attachment[]) => {
    const hasText = input.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;

    if ((!hasText && !hasAttachments) || !runningModel || isLoading) return;

    const userContent = input.trim();
    const imageAttachments = attachments?.filter((a) => a.type === 'image' && a.base64) || [];

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent || (imageAttachments.length > 0 ? '[Image]' : ''),
      images: imageAttachments.map((a) => a.base64!),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Create abort controller for stopping generation
    abortControllerRef.current = new AbortController();

    try {
      // Build messages in OpenAI format
      const apiMessages = buildAPIMessages([...messages, userMessage]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model: runningModel,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        fullContent += text;

        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: fullContent,
            };
          }
          return updated;
        });
      }

      // Mark as no longer streaming
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            isStreaming: false,
          };
        }
        return updated;
      });

      // Persist to backend (if sessions available)
      if (sessionsAvailable) {
        try {
          let sessionId = currentSessionId;

          // Create session if needed
          if (!sessionId) {
            const title = userContent.slice(0, 50) || 'New Chat';
            const { session } = await api.createChatSession({ title, model: runningModel || undefined });
            sessionId = session.id;
            setCurrentSessionId(sessionId);
            setSessions((prev) => [session, ...prev]);
          }

          // Save both messages
          await api.addChatMessage(sessionId, {
            role: 'user',
            content: userContent,
            model: runningModel || undefined,
          });
          await api.addChatMessage(sessionId, {
            role: 'assistant',
            content: fullContent,
            model: runningModel || undefined,
          });
        } catch (persistError) {
          console.error('Failed to persist messages:', persistError);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              isStreaming: false,
            };
          }
          return updated;
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
  };

  const regenerate = async () => {
    if (messages.length < 2) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;

    const lastUserMsg = messages[lastUserIdx];
    setMessages(messages.slice(0, lastUserIdx));
    setInput(lastUserMsg.content);

    // Re-send with same images if any
    setTimeout(() => {
      const attachments: Attachment[] = (lastUserMsg.images || []).map((base64, i) => ({
        id: `regen-${i}`,
        type: 'image' as const,
        name: `image-${i}`,
        size: 0,
        base64,
      }));
      sendMessage(attachments.length > 0 ? attachments : undefined);
    }, 100);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-pulse-soft">
          <Sparkles className="h-8 w-8 text-[var(--muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - only show if sessions available */}
      {sessionsAvailable && (
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={loadSession}
          onNewSession={createSession}
          onDeleteSession={deleteSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isLoading={sessionsLoading}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4 animate-fade-in">
                <Sparkles className="h-6 w-6 text-[var(--muted)] mx-auto mb-3" />
                <p className="text-sm text-[var(--muted)]">
                  {runningModel ? 'Send a message to start' : 'No model running'}
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-3">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`px-4 py-2 animate-slide-up ${
                    message.role === 'assistant' ? 'bg-[var(--card)]' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user'
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--success)]/20'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Sparkles
                          className={`h-3 w-3 text-[var(--success)] ${
                            message.isStreaming ? 'animate-pulse-soft' : ''
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[var(--muted)]">
                          {message.role === 'user' ? 'You' : modelName}
                        </span>
                        <button
                          onClick={() => copyToClipboard(message.content, index)}
                          className="p-0.5 rounded hover:bg-[var(--accent)] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3 w-3 text-[var(--success)]" />
                          ) : (
                            <Copy className="h-3 w-3 text-[var(--muted)]" />
                          )}
                        </button>
                      </div>

                      {/* Show images for user messages */}
                      {message.images && message.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.images.map((base64, i) => (
                            <img
                              key={i}
                              src={`data:image/jpeg;base64,${base64}`}
                              alt={`Uploaded image ${i + 1}`}
                              className="max-w-[150px] max-h-[150px] rounded border border-[var(--border)]"
                            />
                          ))}
                        </div>
                      )}

                      <div className="text-sm">
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <MessageRenderer
                            content={message.content}
                            isStreaming={message.isStreaming}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading &&
                messages[messages.length - 1]?.role === 'assistant' &&
                messages[messages.length - 1]?.content === '' && (
                  <div className="px-4 py-2 bg-[var(--card)]">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-[var(--success)]/20 flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-[var(--success)] animate-pulse-soft" />
                      </div>
                      <div className="flex items-center">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse-soft" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse-soft" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-pulse-soft" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {error && (
                <div className="mx-4 my-2 px-3 py-2 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded text-xs text-[var(--error)] animate-slide-up">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Tool Belt */}
        <ToolBelt
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          onStop={stopGeneration}
          disabled={!runningModel}
          isLoading={isLoading}
          modelName={modelName}
          placeholder={runningModel ? 'Message...' : 'No model running'}
          mcpEnabled={mcpEnabled}
          onMcpToggle={() => setMcpEnabled(!mcpEnabled)}
          mcpServers={mcpServers.map((s) => ({ name: s.name, enabled: s.enabled }))}
          artifactsEnabled={artifactsEnabled}
          onArtifactsToggle={() => setArtifactsEnabled(!artifactsEnabled)}
          onOpenMcpSettings={() => setMcpSettingsOpen(true)}
        />
      </div>

      {/* MCP Settings Modal */}
      <MCPSettingsModal
        isOpen={mcpSettingsOpen}
        onClose={() => setMcpSettingsOpen(false)}
        servers={mcpServers}
        onServersChange={(newServers) => {
          setMcpServers(newServers);
        }}
      />
    </div>
  );
}
