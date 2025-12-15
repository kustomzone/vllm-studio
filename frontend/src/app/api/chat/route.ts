import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://homelabai.org';
const API_KEY = process.env.API_KEY || 'sk-homelabai-3fe751380eb7ac8701f670bee4a56b8ebff8365c68828faa';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Direct call to vLLM/OpenAI-compatible API with streaming
    const response = await fetch(`${API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'glm-4.6v-8bit',
        messages: messages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return new Response(JSON.stringify({ error: `Backend error: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: 'No response body' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Stream format: JSON lines with {type: "thinking" | "content", text: "..."}
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let inThinking = false;
        let thinkingStarted = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta;

                // Handle reasoning_content (thinking)
                if (delta?.reasoning_content) {
                  if (!thinkingStarted) {
                    // Send thinking start marker
                    controller.enqueue(encoder.encode('<think>'));
                    thinkingStarted = true;
                    inThinking = true;
                  }
                  controller.enqueue(encoder.encode(delta.reasoning_content));
                }

                // Handle content (final answer)
                if (delta?.content) {
                  if (inThinking) {
                    // End thinking block before content
                    controller.enqueue(encoder.encode('</think>'));
                    inThinking = false;
                  }
                  controller.enqueue(encoder.encode(delta.content));
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }

        // Close thinking if still open
        if (inThinking) {
          controller.enqueue(encoder.encode('</think>'));
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
