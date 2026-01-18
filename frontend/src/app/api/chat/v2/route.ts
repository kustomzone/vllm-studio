import { streamText, CoreMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getApiSettings } from "@/lib/api-settings";

// Allow streaming responses up to 5 minutes (model launches can take time)
export const maxDuration = 300;

interface PostBody {
  messages: Array<{
    role: string;
    content?: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  }>;
  model?: string;
  tools?: unknown;
  systemPrompt?: string;
}

function getClientInfo(req: Request) {
  const ip = req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    req.headers.get("X-Real-IP") ||
    "unknown";
  const country = req.headers.get("CF-IPCountry") || "-";
  return { ip, country };
}

export async function POST(req: Request) {
  const client = getClientInfo(req);

  try {
    const body: PostBody = await req.json();
    const { messages, model, systemPrompt, ...rest } = body;

    console.log(
      `[CHAT V2] ip=${client.ip} | country=${client.country} | model=${model || "default"} | messages=${messages?.length || 0}`,
    );

    // Debug: Log first message structure to understand AI SDK format
    if (messages && messages.length > 0) {
      console.log(`[CHAT V2 DEBUG] First message structure:`, JSON.stringify(messages[0], null, 2));
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get dynamic settings
    const settings = await getApiSettings();
    const BACKEND_URL = settings.backendUrl;
    const API_KEY = settings.apiKey;

    // Create OpenAI-compatible client for vLLM/LiteLLM
    const customModel = createOpenAICompatible({
      name: "vllm-studio",
      baseURL: `${BACKEND_URL}/v1`,
      apiKey: API_KEY || "sk-master",
    });

    // Convert messages to CoreMessage format
    // AI SDK sends messages with "parts" array, we need to convert to our format
    const coreMessages = messages.map((msg) => {
      const role = msg.role as "user" | "assistant" | "system";

      // Handle AI SDK format with parts
      if (msg.parts && Array.isArray(msg.parts)) {
        // Extract text from parts
        const textParts = msg.parts
          .filter((part) => part.type === "text")
          .map((part) => (part as { text: string }).text)
          .join("");

        return { role, content: textParts };
      }

      // Handle content as string
      if (typeof msg.content === "string") {
        return { role, content: msg.content };
      }

      // Handle content as array (multimodal)
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((part) => part.type === "text")
          .map((part) => part.text || "")
          .join("");

        return { role, content: textParts };
      }

      // Fallback
      return { role, content: "" };
    }) as CoreMessage[];

    // Add system prompt if provided
    if (systemPrompt?.trim()) {
      coreMessages.unshift({ role: "system", content: systemPrompt });
    }

    // Use AI SDK streamText
    const result = streamText({
      model: customModel(model || "default"),
      messages: coreMessages,
      temperature: 0.7,
    });

    // Return UI message stream response
    return result.toUIMessageStreamResponse({
      // Custom error handler to preserve error details
      onError: (error) => {
        if (error == null) return "Unknown error";
        if (typeof error === "string") return error;
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
      },
    });
  } catch (error) {
    console.error(
      `[CHAT V2 ERROR] ip=${client.ip} | country=${client.country} | error=${String(error)}`,
    );
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
