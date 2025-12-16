'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  User,
  Copy,
  Check,
  Menu,
  Plus,
} from 'lucide-react';
import api from '@/lib/api';
import type { ChatSession, ToolCall, ToolResult, MCPTool } from '@/lib/types';
import { MessageRenderer, ChatSidebar, ToolBelt, MCPSettingsModal, ChatSettingsModal } from '@/components/chat';
import { ToolCallCard } from '@/components/chat/tool-call-card';
import type { Attachment, MCPServerConfig } from '@/components/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 images for display
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface StreamEvent {
  type: 'text' | 'tool_calls' | 'done' | 'error';
  content?: string;
  tool_calls?: ToolCall[];
  error?: string;
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type OpenAIMessage =
  | {
      role: 'user' | 'assistant' | 'system';
      content: string | null | OpenAIContentPart[];
      tool_calls?: OpenAIToolCall[];
    }
  | {
      role: 'tool';
      tool_call_id: string;
      content: string;
    };

const BOX_TAGS_PATTERN = /<\|(?:begin|end)_of_box\|>/g;
const stripThinkingForModelContext = (text: string) => {
  if (!text) return text;
  let cleaned = text.replace(BOX_TAGS_PATTERN, '');
  cleaned = cleaned.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
  cleaned = cleaned.replace(/<\/?think(?:ing)?>/gi, '');
  return cleaned.trim();
};

export default function ChatPage() {
  // Session state
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
  const [isMobile, setIsMobile] = useState(false);

  // MCP & Artifacts state
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [artifactsEnabled, setArtifactsEnabled] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [mcpSettingsOpen, setMcpSettingsOpen] = useState(false);
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set());
  const [toolResultsMap, setToolResultsMap] = useState<Map<string, ToolResult>>(new Map());

  // Chat settings state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadStatus();
    loadSessions();
    loadMCPServers();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (mcpEnabled) {
      loadMCPTools();
    } else {
      setMcpTools([]);
    }
  }, [mcpEnabled]);

  const loadMCPServers = async () => {
    try {
      const servers = await api.getMCPServers();
      setMcpServers(servers.map((s) => ({ ...s, env: s.env || {} })));
    } catch (e) {
      console.log('MCP servers not available:', e);
    }
  };

  const loadMCPTools = async () => {
    try {
      const response = await api.getMCPTools();
      setMcpTools(response.tools || []);
      console.log('[MCP] Loaded tools:', response.tools?.length || 0);
    } catch (e) {
      console.log('MCP tools not available:', e);
      setMcpTools([]);
    }
  };

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
      console.log('Chat sessions API not available', e);
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
    setTimeout(() => {
      const inputEl = document.querySelector('textarea');
      inputEl?.focus();
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

  // Parse SSE events from the stream
  const parseSSEEvents = async function* (reader: ReadableStreamDefaultReader<Uint8Array>) {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data) {
            try {
              yield JSON.parse(data) as StreamEvent;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }
  };

  // Build API messages with system prompt
  const buildAPIMessages = (msgs: Message[]) => {
    const apiMessages: OpenAIMessage[] = [];

    // Prepend system prompt if set
    if (systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: systemPrompt.trim() });
    }

    for (const m of msgs) {
      if (m.images && m.images.length > 0) {
        const content: OpenAIContentPart[] = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const base64 of m.images) {
          content.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          });
        }
        apiMessages.push({ role: m.role, content });
      } else {
        const content =
          m.role === 'assistant' ? stripThinkingForModelContext(m.content) : m.content;
        apiMessages.push({ role: m.role, content });
      }
    }

    return apiMessages;
  };

  // Convert MCP tools to OpenAI function format
  const getOpenAITools = () => {
    if (!mcpEnabled || mcpTools.length === 0) return undefined;
    return mcpTools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: `${tool.server}__${tool.name}`,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  };

  // Execute an MCP tool call
  const executeMCPTool = async (toolCall: ToolCall): Promise<ToolResult> => {
    const funcName = toolCall.function.name;
    const [server, ...nameParts] = funcName.split('__');
    const toolName = nameParts.join('__');

    const parseToolArgs = (raw: string | undefined): Record<string, unknown> => {
      const text = (raw || '').trim();
      if (!text) return {};
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        // Try to extract the first valid JSON object/array from a concatenated string
        const firstCharIdx = text.search(/[{\[]/);
        if (firstCharIdx === -1) return { raw: text };
        const startChar = text[firstCharIdx];
        const endChar = startChar === '{' ? '}' : ']';
        let depth = 0;
        for (let i = firstCharIdx; i < text.length; i++) {
          const ch = text[i];
          if (ch === startChar) depth++;
          if (ch === endChar) depth--;
          if (depth === 0) {
            const candidate = text.slice(firstCharIdx, i + 1);
            try {
              return JSON.parse(candidate) as Record<string, unknown>;
            } catch {
              break;
            }
          }
        }
        return { raw: text };
      }
    };

    try {
      const args = parseToolArgs(toolCall.function.arguments);
      console.log(`[MCP] Calling ${server}/${toolName}`, args);
      const result = await api.callMCPTool(server, toolName, args);
      return {
        tool_call_id: toolCall.id,
        content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
      };
    } catch (error) {
      console.error(`[MCP] Tool error:`, error);
      return {
        tool_call_id: toolCall.id,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
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

    abortControllerRef.current = new AbortController();

    // Track conversation for tool calling loop
    const conversationMessages = buildAPIMessages([...messages, userMessage]);
    let fullContent = '';
    let sessionId = currentSessionId;

    try {
      // Tool calling loop - continues until no more tool calls
      let iteration = 0;
      const MAX_ITERATIONS = 10;

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationMessages,
            model: runningModel,
            tools: getOpenAITools(),
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        // Create or update assistant message
        const assistantMsgId = (Date.now() + iteration).toString();
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
            return prev; // Keep existing streaming message
          }
          return [...prev, { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true }];
        });

        let iterationContent = '';
        let toolCalls: ToolCall[] = [];

        // Process SSE events
        for await (const event of parseSSEEvents(reader)) {
          if (event.type === 'text' && event.content) {
            iterationContent += event.content;
            fullContent += event.content;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
              }
              return updated;
            });
          } else if (event.type === 'tool_calls' && event.tool_calls) {
            toolCalls = event.tool_calls;
            // Update message with tool calls
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.role === 'assistant') {
                updated[lastIdx] = { ...updated[lastIdx], toolCalls };
              }
              return updated;
            });
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Stream error');
          }
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.role === 'assistant') {
              updated[lastIdx] = { ...updated[lastIdx], isStreaming: false };
            }
            return updated;
          });
          break;
        }

        // Execute tool calls
        console.log(`[MCP] Executing ${toolCalls.length} tool call(s)`);
        const toolResults: ToolResult[] = [];

        for (const tc of toolCalls) {
          setExecutingTools((prev) => new Set(prev).add(tc.id));
          const result = await executeMCPTool(tc);
          toolResults.push(result);
          setToolResultsMap((prev) => new Map(prev).set(tc.id, result));
          setExecutingTools((prev) => {
            const next = new Set(prev);
            next.delete(tc.id);
            return next;
          });
        }

        // Update message with results
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], toolResults, isStreaming: false };
          }
          return updated;
        });

        // Add assistant message with tool calls to conversation
        conversationMessages.push({
          role: 'assistant',
          content: iterationContent ? stripThinkingForModelContext(iterationContent) : null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });

        // Add tool results to conversation
        for (const result of toolResults) {
          conversationMessages.push({
            role: 'tool',
            tool_call_id: result.tool_call_id,
            content: result.content,
          });
        }
      }

      // Persist to backend
      if (sessionsAvailable && fullContent) {
        try {
          if (!sessionId) {
            const title = userContent.slice(0, 50) || 'New Chat';
            const { session } = await api.createChatSession({ title, model: runningModel || undefined });
            sessionId = session.id;
            setCurrentSessionId(sessionId);
            setSessions((prev) => [session, ...prev]);
          }

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
            updated[lastIdx] = { ...updated[lastIdx], isStreaming: false };
          }
          return updated;
        });
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        setMessages((prev) => {
          if (prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.content === '') {
            return prev.slice(0, -1);
          }
          return prev;
        });
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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Mobile Header */}
      {isMobile && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--card)]">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
            title="Chat history"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium truncate mx-2">
            {modelName || 'Chat'}
          </span>
          <button
            onClick={createSession}
            className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
            title="New chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={loadSession}
          onNewSession={createSession}
          onDeleteSession={deleteSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isLoading={sessionsLoading}
          isMobile={isMobile}
        />

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
                            className="p-0.5 rounded hover:bg-[var(--accent)] transition-colors"
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
                            <>
                              <MessageRenderer
                                content={message.content}
                                isStreaming={message.isStreaming}
                                artifactsEnabled={artifactsEnabled}
                              />
                              {/* Tool Calls Display */}
                              {message.toolCalls && message.toolCalls.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {message.toolCalls.map((toolCall) => (
                                    <ToolCallCard
                                      key={toolCall.id}
                                      toolCall={toolCall}
                                      result={toolResultsMap.get(toolCall.id)}
                                      isExecuting={executingTools.has(toolCall.id)}
                                    />
                                  ))}
                                </div>
                              )}
                            </>
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
            onOpenChatSettings={() => setChatSettingsOpen(true)}
            hasSystemPrompt={systemPrompt.trim().length > 0}
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

        {/* Chat Settings Modal */}
        <ChatSettingsModal
          isOpen={chatSettingsOpen}
          onClose={() => setChatSettingsOpen(false)}
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
        />
      </div>
    </div>
  );
}
