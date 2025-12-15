import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'sk-homelabai-3fe751380eb7ac8701f670bee4a56b8ebff8365c68828faa';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    console.log('[Chat API] Request:', { model, messageCount: messages?.length });

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const backendUrl = `${API_URL}/v1/chat/completions`;
    console.log('[Chat API] Calling:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'default',
        messages: messages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    console.log('[Chat API] Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[Chat API] Backend error:', error);
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

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let totalChunks = 0;

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

                // Pass through all content directly
                if (delta?.content) {
                  totalChunks++;
                  controller.enqueue(encoder.encode(delta.content));
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }

        console.log('[Chat API] Stream complete, total chunks:', totalChunks);
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
    console.error('[Chat API] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
