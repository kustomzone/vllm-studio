import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || '';

const BOX_TAGS_PATTERN = /<\|(?:begin|end)_of_box\|>/g;
const stripBoxTags = (text: string) => (text ? text.replace(BOX_TAGS_PATTERN, '') : text);

interface StreamEvent {
  type: 'text' | 'reasoning' | 'tool_calls' | 'done' | 'error';
  content?: string;
  tool_calls?: ToolCall[];
  error?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIDelta {
  role?: string;
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

type OpenAIToolCallDelta = NonNullable<OpenAIDelta['tool_calls']>[number];

interface OpenAIChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: OpenAIDelta;
    finish_reason: string | null;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model, tools } = body;

    console.log('[Chat API] Request:', {
      model,
      messageCount: messages?.length,
      toolCount: tools?.length,
    });

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build request body for vLLM
    const requestBody: Record<string, unknown> = {
      model: model || 'default',
      messages,
      stream: true,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    // Direct fetch to vLLM to capture reasoning_content field
    const response = await fetch(`${API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error ${response.status}: ${errorText}`);
    }

    const encoder = new TextEncoder();
    const sendEvent = (event: StreamEvent): Uint8Array => {
      return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Track tool calls being assembled (streaming deltas can split id/name/args)
    const toolCallsInProgress: Map<number, ToolCall> = new Map();
    let inReasoning = false;
    let toolsEmitted = false;

    const isCompleteJson = (text: string): boolean => {
      const t = (text || '').trim();
      if (!t) return false;
      if (!(t.startsWith('{') || t.startsWith('['))) return false;
      try {
        JSON.parse(t);
        return true;
      } catch {
        return false;
      }
    };

    const mergeToolCallArguments = (existing: string, incoming: string): string => {
      const prev = existing || '';
      const next = incoming || '';
      if (!next) return prev;
      if (!prev) return next;
      if (prev === next) return prev;
      // If the backend sends full JSON payloads repeatedly (often with different whitespace),
      // treat the newest complete JSON as authoritative to avoid `}{` concatenation.
      if (isCompleteJson(next)) return next.trim();
      // Some backends resend the full JSON each delta instead of streaming fragments
      if (prev.endsWith(next)) return prev;
      if (next.startsWith(prev)) return next;
      // Some backends repeat the prefix again
      if (prev.startsWith(next)) return prev;
      return prev + next;
    };

    const upsertToolCallDelta = (tc: OpenAIToolCallDelta) => {
      const idx = tc.index;
      const existing =
        toolCallsInProgress.get(idx) ||
        ({
          id: tc.id || `call_${idx}`,
          type: 'function' as const,
          function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
        } satisfies ToolCall);

      if (tc.id && (existing.id.startsWith('call_') || !existing.id)) {
        existing.id = tc.id;
      }
      if (tc.function?.name) {
        existing.function.name = tc.function.name;
      }
      if (tc.function?.arguments) {
        existing.function.arguments = mergeToolCallArguments(
          existing.function.arguments,
          tc.function.arguments
        );
      }

      toolCallsInProgress.set(idx, existing);
    };

    const emitCompletedToolsIfAny = (controller: ReadableStreamDefaultController) => {
      if (toolsEmitted || toolCallsInProgress.size === 0) return;
      const completedTools = Array.from(toolCallsInProgress.entries())
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v);
      controller.enqueue(sendEvent({ type: 'tool_calls', tool_calls: completedTools }));
      toolsEmitted = true;
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data) continue;
              if (data === '[DONE]') {
                continue;
              }

              try {
                const chunk: OpenAIChunk = JSON.parse(data);
                const delta = chunk.choices[0]?.delta;
                if (!delta) continue;

                // Handle reasoning content (GLM, DeepSeek, etc.)
                const reasoning = delta.reasoning_content || delta.reasoning;
                if (reasoning) {
                  if (!inReasoning) {
                    // Start thinking block
                    controller.enqueue(sendEvent({ type: 'text', content: '<think>' }));
                    inReasoning = true;
                  }
                  controller.enqueue(sendEvent({ type: 'text', content: stripBoxTags(reasoning) }));
                }

                // Handle regular content
                if (delta.content) {
                  if (inReasoning) {
                    // Close thinking block before content
                    controller.enqueue(sendEvent({ type: 'text', content: '</think>\n\n' }));
                    inReasoning = false;
                  }
                  controller.enqueue(sendEvent({ type: 'text', content: stripBoxTags(delta.content) }));
                }

                // Handle tool calls
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    upsertToolCallDelta(tc);
                  }
                }

                // Check for finish
                if (chunk.choices[0]?.finish_reason) {
                  if (inReasoning) {
                    controller.enqueue(sendEvent({ type: 'text', content: '</think>\n\n' }));
                    inReasoning = false;
                  }

                  emitCompletedToolsIfAny(controller);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }

          if (inReasoning) {
            controller.enqueue(sendEvent({ type: 'text', content: '</think>\n\n' }));
            inReasoning = false;
          }
          emitCompletedToolsIfAny(controller);
          controller.enqueue(sendEvent({ type: 'done' }));
        } catch (error) {
          console.error('[Chat API] Stream error:', error);
          controller.enqueue(sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
