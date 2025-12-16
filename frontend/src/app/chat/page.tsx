'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  User,
  Copy,
  Check,
  Menu,
  Plus,
  GitBranch,
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
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number | null;
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
      name?: string;
      content: string;
    };

const BOX_TAGS_PATTERN = /<\|(?:begin|end)_of_box\|>/g;
const stripThinkingForModelContext = (text: string) => {
  if (!text) return text;
  let cleaned = text.replace(BOX_TAGS_PATTERN, '');
  // Preserve any "renderable" code fences that were placed inside <think> blocks (models sometimes do this),
  // but strip the rest of the thinking content so we don't feed back chain-of-thought.
  const preservedBlocks: string[] = [];
  cleaned = cleaned.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, (block) => {
    const fenceRegex = /```([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = fenceRegex.exec(block)) !== null) {
      const lang = (m[1] || '').toLowerCase();
      const isRenderable =
        ['html', 'svg', 'javascript', 'js', 'react', 'jsx', 'tsx'].includes(lang) ||
        lang.startsWith('artifact-');
      if (isRenderable) {
        preservedBlocks.push(`\n\n\`\`\`${lang}\n${m[2].trim()}\n\`\`\``);
      }
    }
    return '';
  });
  cleaned = cleaned.replace(/<\/?think(?:ing)?>/gi, '');
  return (cleaned.trim() + preservedBlocks.join('')).trim();
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
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; root?: string; max_model_len?: number }>>([]);
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
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    try {
      const res = await api.getOpenAIModels();
      const data = Array.isArray(res.data) ? res.data : [];
      setAvailableModels(data.map((m) => ({ id: m.id, root: m.root, max_model_len: m.max_model_len })));
    } catch (e) {
      console.log('OpenAI models endpoint not available:', e);
      setAvailableModels([]);
    }
  };

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
        setSelectedModel((prev) => prev || modelId);
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
      setSessionsAvailable(true);
    } catch (e) {
      console.log('Chat sessions API not available', e);
      setSessionsAvailable(false);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const data = await api.getChatSession(sessionId);
      const session = data.session;
      const loadedToolResults = new Map<string, ToolResult>();
      const loadedMessages: Message[] = (session.messages || [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          const base: Message = {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            model: m.model,
            prompt_tokens: (m as any).prompt_tokens,
            completion_tokens: (m as any).completion_tokens,
            total_tokens: (m as any).total_tokens,
            estimated_cost_usd: (m as any).estimated_cost_usd ?? null,
          };

          if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
            const toolCalls: ToolCall[] = [];
            const toolResults: ToolResult[] = [];

            for (const entry of m.tool_calls) {
              const tc = entry as any;
              if (!tc || typeof tc !== 'object') continue;
              if (typeof tc.id !== 'string' || !tc.function || typeof tc.function.name !== 'string') continue;
              toolCalls.push({
                id: tc.id,
                type: 'function',
                function: {
                  name: String(tc.function.name),
                  arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? ''),
                },
              });

              const res = tc.result as any;
              if (res && typeof res === 'object' && typeof res.content === 'string') {
                const toolResult: ToolResult = {
                  tool_call_id: tc.id,
                  content: res.content,
                  isError: Boolean(res.isError),
                };
                toolResults.push(toolResult);
                loadedToolResults.set(tc.id, toolResult);
              }
            }

            if (toolCalls.length > 0) {
              base.toolCalls = toolCalls;
            }
            if (toolResults.length > 0) {
              base.toolResults = toolResults;
            }
          }

          return base;
        });
      setMessages(loadedMessages);
      setToolResultsMap(loadedToolResults);
      setExecutingTools(new Set());
      setCurrentSessionId(sessionId);
      if (session.model) setSelectedModel(session.model);
    } catch (e) {
      console.error('Failed to load session:', e);
      setError('Failed to load conversation');
    }
  };

  const createSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setError(null);
    setSelectedModel(runningModel || availableModels[0]?.id || '');
    setTimeout(() => {
      const inputEl = document.querySelector('textarea');
      inputEl?.focus();
    }, 100);
  };

  const deleteSession = async (sessionId: string) => {
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
    if (mcpEnabled) {
      apiMessages.push({
        role: 'system',
        content:
          'If you call tools, do not repeat the same tool call with identical arguments. Use tool results and then answer.',
      });
    }
    if (artifactsEnabled) {
      apiMessages.push({
        role: 'system',
        content:
          'If you output code intended for preview (HTML/SVG/JS/JSX/TSX), put it in the normal response (not inside <think> blocks).',
      });
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
        continue;
      }

      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const assistantContent = stripThinkingForModelContext(m.content) || null;
        apiMessages.push({
          role: 'assistant',
          content: assistantContent,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });

        const nameById = new Map(m.toolCalls.map((tc) => [tc.id, tc.function.name]));
        for (const result of m.toolResults || []) {
          apiMessages.push({
            role: 'tool',
            tool_call_id: result.tool_call_id,
            name: nameById.get(result.tool_call_id),
            content: result.content,
          });
        }
        continue;
      }

      const content =
        m.role === 'assistant' ? stripThinkingForModelContext(m.content) : m.content;
      apiMessages.push({ role: m.role, content });
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

    const resolveMcpTool = (name: string): { server: string; toolName: string; schema?: MCPTool } | null => {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;

      // Preferred format: `${server}__${tool}`
      if (trimmed.includes('__')) {
        const [server, ...nameParts] = trimmed.split('__');
        const toolName = nameParts.join('__');
        if (!server || !toolName) return null;
        const schema = mcpTools.find((t) => t.server === server && t.name === toolName);
        return { server, toolName, schema };
      }

      // Some models output only the tool name; try exact match across servers.
      const exact = mcpTools.find((t) => t.name === trimmed);
      if (exact) return { server: exact.server, toolName: exact.name, schema: exact };

      const lower = trimmed.toLowerCase();
      const haystack = (t: MCPTool) => `${t.name} ${t.description || ''}`.toLowerCase();

      // Common aliases
      const isSearch = /(^|_|\b)(search|web|browse|brave)(\b|_)/.test(lower);
      const isFetch = /(^|_|\b)(fetch|http|url|download|read)(\b|_)/.test(lower);

      let candidates = mcpTools;
      if (isSearch) {
        candidates = candidates.filter((t) => /search|brave|web/.test(haystack(t)));
      } else if (isFetch) {
        candidates = candidates.filter((t) => /fetch|http|url|download|read/.test(haystack(t)));
      }

      return candidates.length > 0 ? { server: candidates[0].server, toolName: candidates[0].name, schema: candidates[0] } : null;
    };

    const resolved = resolveMcpTool(funcName);
    const server = resolved?.server || '';
    const toolName = resolved?.toolName || '';

    const parseToolArgs = (raw: string | undefined): Record<string, unknown> => {
      const text = (raw || '').trim();
      if (!text) return {};
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
        return { input: parsed };
      } catch {
        // Try to extract the last valid JSON object/array from a concatenated string
        let lastParsed: unknown = undefined;
        for (let start = 0; start < text.length; start++) {
          const startChar = text[start];
          if (startChar !== '{' && startChar !== '[') continue;
          const endChar = startChar === '{' ? '}' : ']';
          let depth = 0;
          let inString = false;
          let escape = false;

          for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
              if (escape) {
                escape = false;
              } else if (ch === '\\\\') {
                escape = true;
              } else if (ch === '"') {
                inString = false;
              }
              continue;
            }

            if (ch === '"') {
              inString = true;
              continue;
            }

            if (ch === startChar) depth++;
            if (ch === endChar) depth--;

            if (depth === 0) {
              const candidate = text.slice(start, i + 1);
              try {
                lastParsed = JSON.parse(candidate);
              } catch {
                // ignore
              }
              break;
            }
          }
        }

        if (lastParsed !== undefined) {
          if (lastParsed && typeof lastParsed === 'object' && !Array.isArray(lastParsed)) {
            return lastParsed as Record<string, unknown>;
          }
          return { input: lastParsed };
        }

        return { raw: text };
      }
    };

    try {
      if (!resolved) {
        const available = mcpTools.slice(0, 12).map((t) => `${t.server}__${t.name}`).join(', ');
        return {
          tool_call_id: toolCall.id,
          content: `Error: Unknown tool "${funcName}". Available tools include: ${available}${mcpTools.length > 12 ? ', ...' : ''}`,
          isError: true,
        };
      }

      let args = parseToolArgs(toolCall.function.arguments);

      // Heuristic coercions for common "input" shapes.
      const schema = resolved.schema;
      const schemaProps = (schema?.input_schema as any)?.properties as Record<string, any> | undefined;
      const wantsQuery = !!schemaProps && Object.prototype.hasOwnProperty.call(schemaProps, 'query');
      const wantsUrl = !!schemaProps && (Object.prototype.hasOwnProperty.call(schemaProps, 'url') || Object.prototype.hasOwnProperty.call(schemaProps, 'uri'));

      if (args && typeof args === 'object' && 'input' in args) {
        const input = (args as any).input;
        if (wantsQuery && (typeof input === 'string' || Array.isArray(input))) {
          const query = Array.isArray(input) ? String(input[0] ?? '') : String(input);
          args = { query, ...(typeof (args as any).count === 'number' ? { count: (args as any).count } : { count: 5 }) };
        } else if (wantsUrl && (typeof input === 'string' || Array.isArray(input))) {
          const url = Array.isArray(input) ? String(input[0] ?? '') : String(input);
          args = { url };
        }
      }

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

    const activeModelId = (selectedModel || runningModel || '').trim();
    if ((!hasText && !hasAttachments) || !activeModelId || isLoading) return;

    const userContent = input.trim();
    const imageAttachments = attachments?.filter((a) => a.type === 'image' && a.base64) || [];

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent || (imageAttachments.length > 0 ? '[Image]' : ''),
      images: imageAttachments.map((a) => a.base64!),
      model: activeModelId,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    // Track conversation for tool calling loop
    const conversationMessages = buildAPIMessages([...messages, userMessage]);
    let sessionId = currentSessionId;
    const isNewSession = !sessionId;
    let finalAssistantContent = '';

    const bumpSessionUpdatedAt = () => {
      if (!sessionId) return;
      setSessions((prev) => {
        const now = new Date().toISOString();
        const existing = prev.find((s) => s.id === sessionId);
        const updated = existing ? { ...existing, updated_at: now } : undefined;
        const rest = prev.filter((s) => s.id !== sessionId);
        return updated ? [updated, ...rest] : prev;
      });
    };

    try {
      // Create session early so it shows in the sidebar immediately.
      if (!sessionId) {
        try {
          const { session } = await api.createChatSession({ title: 'New Chat', model: activeModelId || undefined });
          sessionId = session.id;
          setCurrentSessionId(sessionId);
          setSessions((prev) => [session, ...prev]);
          setSessionsAvailable(true);
        } catch (e) {
          console.log('Failed to create chat session (continuing without persistence):', e);
        }
      }

      // Persist the user message up-front (best-effort).
      if (sessionId) {
        try {
          const persisted = await api.addChatMessage(sessionId, {
            id: userMessage.id,
            role: 'user',
            content: userContent,
            model: activeModelId || undefined,
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === persisted.id
                ? {
                    ...m,
                    model: persisted.model || m.model,
                    prompt_tokens: (persisted as any).prompt_tokens,
                    completion_tokens: (persisted as any).completion_tokens,
                    total_tokens: (persisted as any).total_tokens,
                    estimated_cost_usd: (persisted as any).estimated_cost_usd ?? null,
                  }
                : m
            )
          );
          bumpSessionUpdatedAt();
          setSessionsAvailable(true);
        } catch (e) {
          console.log('Failed to persist user message:', e);
        }
      }

      // Tool calling loop - continues until no more tool calls
      let iteration = 0;
      const MAX_ITERATIONS = 10;
      const cachedToolResultsBySignature = new Map<string, Omit<ToolResult, 'tool_call_id'>>();

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationMessages,
            model: activeModelId,
            tools: getOpenAITools(),
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        // Create a new assistant message per iteration (tool loops are multiple assistant turns).
        const assistantMsgId = (Date.now() + iteration).toString();
        setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true, model: activeModelId }]);

        let iterationContent = '';
        let toolCalls: ToolCall[] = [];

        // Process SSE events
        for await (const event of parseSSEEvents(reader)) {
          if (event.type === 'text' && event.content) {
            iterationContent += event.content;
            setMessages((prev) => {
              return prev.map((m) => (m.id === assistantMsgId ? { ...m, content: iterationContent } : m));
            });
          } else if (event.type === 'tool_calls' && event.tool_calls) {
            toolCalls = event.tool_calls;
            // Update message with tool calls
            setMessages((prev) => {
              return prev.map((m) => (m.id === assistantMsgId ? { ...m, toolCalls } : m));
            });
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Stream error');
          }
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          finalAssistantContent = iterationContent;
          setMessages((prev) => {
            return prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m));
          });

          // Persist final assistant message (best-effort).
          if (sessionId) {
            try {
              const persisted = await api.addChatMessage(sessionId, {
                id: assistantMsgId,
                role: 'assistant',
                content: iterationContent,
                model: activeModelId || undefined,
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === persisted.id
                    ? {
                        ...m,
                        model: persisted.model || m.model,
                        prompt_tokens: (persisted as any).prompt_tokens,
                        completion_tokens: (persisted as any).completion_tokens,
                        total_tokens: (persisted as any).total_tokens,
                        estimated_cost_usd: (persisted as any).estimated_cost_usd ?? null,
                      }
                    : m
                )
              );
              bumpSessionUpdatedAt();
              setSessionsAvailable(true);
            } catch (e) {
              console.log('Failed to persist assistant message:', e);
            }
          }
          break;
        }

        // Execute tool calls
        console.log(`[MCP] Executing ${toolCalls.length} tool call(s)`);
        const toolResults: ToolResult[] = [];
        const toolNameByCallId = new Map<string, string>();

        for (const tc of toolCalls) {
          const signature = (() => {
            const name = tc.function?.name || '';
            const rawArgs = (tc.function?.arguments || '').trim();
            try {
              const parsed = rawArgs ? JSON.parse(rawArgs) : {};
              return `${name}:${JSON.stringify(parsed)}`;
            } catch {
              return `${name}:${rawArgs}`;
            }
          })();

          toolNameByCallId.set(tc.id, tc.function.name);

          // If the model repeats the exact same call, don't re-run it; return a cached result so it can proceed.
          if (cachedToolResultsBySignature.has(signature)) {
            const cached = cachedToolResultsBySignature.get(signature)!;
            const result: ToolResult = {
              tool_call_id: tc.id,
              content: cached.content,
              isError: cached.isError,
            };
            toolResults.push(result);
            setToolResultsMap((prev) => new Map(prev).set(tc.id, result));
            continue;
          }

          setExecutingTools((prev) => new Set(prev).add(tc.id));
          const result = await executeMCPTool(tc);
          cachedToolResultsBySignature.set(signature, { content: result.content, isError: result.isError });
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
          return prev.map((m) =>
            m.id === assistantMsgId ? { ...m, toolResults, isStreaming: false } : m
          );
        });

        // Persist the tool-call assistant turn (best-effort).
        if (sessionId) {
          try {
            const toolCallsForPersistence = toolCalls.map((tc) => {
              const result = toolResults.find((r) => r.tool_call_id === tc.id);
              return { ...tc, result: result || null };
            });
            const persisted = await api.addChatMessage(sessionId, {
              id: assistantMsgId,
              role: 'assistant',
              content: iterationContent,
              model: activeModelId || undefined,
              tool_calls: toolCallsForPersistence,
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === persisted.id
                  ? {
                      ...m,
                      model: persisted.model || m.model,
                      prompt_tokens: (persisted as any).prompt_tokens,
                      completion_tokens: (persisted as any).completion_tokens,
                      total_tokens: (persisted as any).total_tokens,
                      estimated_cost_usd: (persisted as any).estimated_cost_usd ?? null,
                    }
                  : m
              )
            );
            bumpSessionUpdatedAt();
            setSessionsAvailable(true);
          } catch (e) {
            console.log('Failed to persist tool-call turn:', e);
          }
        }

        // Add assistant message with tool calls to conversation
        conversationMessages.push({
          role: 'assistant',
          // Keep any text the model produced before the tool call so it doesn't repeat it after tool results.
          content: stripThinkingForModelContext(iterationContent) || null,
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
            name: toolNameByCallId.get(result.tool_call_id),
            content: result.content,
          });
        }
      }

      // Auto-title new sessions after the final assistant response (best-effort).
      if (isNewSession && sessionId && finalAssistantContent.trim()) {
        try {
          const res = await fetch('/api/title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: activeModelId, user: userContent, assistant: finalAssistantContent }),
          });
          if (res.ok) {
            const data = (await res.json().catch(() => null)) as { title?: string } | null;
            const title = (data?.title || '').trim();
            if (title) {
              await api.updateChatSession(sessionId, { title });
              setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
            }
          }
        } catch (titleError) {
          console.log('Auto-title failed:', titleError);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m) => (m.id === last.id ? { ...m, isStreaming: false } : m));
          }
          return prev;
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

  const forkAtMessage = async (messageId: string) => {
    if (!currentSessionId) return;
    try {
      const { session } = await api.forkChatSession(currentSessionId, {
        message_id: messageId,
        model: (selectedModel || undefined) as string | undefined,
      });
      setSessions((prev) => [session, ...prev]);
      await loadSession(session.id);
    } catch (e) {
      console.log('Fork failed:', e);
      alert('Failed to fork chat');
    }
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
            {selectedModel || modelName || 'Chat'}
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
                    {selectedModel || runningModel ? 'Send a message to start' : 'Select a model in Settings to start'}
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
                            {message.role === 'user' ? 'You' : (message.model || selectedModel || modelName || 'Assistant')}
                          </span>
                          {(message.total_tokens || message.prompt_tokens || message.completion_tokens) && (
                            <span className="text-[10px] text-[var(--muted)] font-mono">
                              {`${(message.total_tokens ?? (message.prompt_tokens || 0) + (message.completion_tokens || 0)).toLocaleString()} tok`}
                              {message.estimated_cost_usd ? ` • $${message.estimated_cost_usd.toFixed(4)}` : ''}
                            </span>
                          )}
                          {currentSessionId && (
                            <button
                              onClick={() => forkAtMessage(message.id)}
                              className="p-0.5 rounded hover:bg-[var(--accent)] transition-colors"
                              title="Fork chat from here"
                            >
                              <GitBranch className="h-3 w-3 text-[var(--muted)]" />
                            </button>
                          )}
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
            disabled={!((selectedModel || runningModel || '').trim())}
            isLoading={isLoading}
            modelName={selectedModel || modelName}
            placeholder={(selectedModel || runningModel) ? 'Message...' : 'Select a model in Settings'}
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
          availableModels={availableModels}
          selectedModel={selectedModel}
          onSelectedModelChange={async (modelId) => {
            const next = (modelId || '').trim();
            setSelectedModel(next);
            if (currentSessionId) {
              try {
                await api.updateChatSession(currentSessionId, { model: next || undefined });
                setSessions((prev) => prev.map((s) => (s.id === currentSessionId ? { ...s, model: next } : s)));
              } catch (e) {
                console.log('Failed to persist chat model:', e);
              }
            }
          }}
          onForkModels={async (modelIds) => {
            const baseId = currentSessionId;
            if (!baseId) return;
            const created: string[] = [];
            for (const m of modelIds) {
              try {
                const { session } = await api.forkChatSession(baseId, { model: m, title: undefined });
                created.push(session.id);
                setSessions((prev) => [session, ...prev]);
              } catch (e) {
                console.log('Fork failed:', e);
              }
            }
            if (created.length > 0) {
              await loadSessions();
              await loadSession(created[0]);
            }
          }}
        />
      </div>
    </div>
  );
}
