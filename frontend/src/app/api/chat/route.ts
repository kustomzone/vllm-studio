import { streamText, jsonSchema, type ToolSet, type ModelMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getApiSettings } from "@/lib/api-settings";

// Allow streaming responses up to 5 minutes (model launches can take time)
export const maxDuration = 300;

interface PostBody {
  messages: Array<{
    id: string;
    role: "system" | "user" | "assistant";
    parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
      | {
          type: "tool";
          toolCallId: string;
          toolName: string;
          state:
            | "input-streaming"
            | "input-available"
            | "output-available"
            | "output-error";
          input?: unknown;
          output?: unknown;
          errorText?: string;
          providerExecuted?: boolean;
        }
    >;
  }>;
  model?: string;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  system?: string;
}

function getClientInfo(req: Request) {
  const ip =
    req.headers.get("CF-Connecting-IP") ||
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
    const { messages, model, tools, system } = body;

    console.log(
      `[CHAT V5] ip=${client.ip} | country=${client.country} | model=${model || "default"} | messages=${messages?.length || 0} | tools=${tools?.length || 0}`,
    );

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
    const openaiCompatible = createOpenAICompatible({
      name: "vllm-studio",
      baseURL: `${BACKEND_URL}/v1`,
      apiKey: API_KEY || "sk-master",
    });

    const modelInstance = openaiCompatible(model || "default");

    // Build tool set with model-only schemas (no server execution)
    // Tools will be emitted to client for execution via onToolCall
    const toolSet = (tools || []).reduce<Record<string, { description?: string; inputSchema: unknown }>>(
      (acc, tool) => {
        acc[tool.name] = {
          description: tool.description,
          inputSchema: jsonSchema(tool.inputSchema || { type: "object", properties: {} }),
        };
        return acc;
      },
      {},
    );

    const coreMessages = (messages || []).map((msg): ModelMessage => {
      const role = msg.role as ModelMessage["role"];
      if (Array.isArray(msg.parts) && msg.parts.length > 0) {
        const textParts = msg.parts
          .filter((part): part is { type: "text"; text: string } =>
            part.type === "text" && typeof part.text === "string",
          )
          .map((part) => part.text)
          .join("");
        return { role, content: textParts } as ModelMessage;
      }
      if (typeof msg === "object" && typeof (msg as { content?: string }).content === "string") {
        return { role, content: (msg as { content?: string }).content as string } as ModelMessage;
      }
      return { role, content: "" } as ModelMessage;
    });

    const result = streamText({
      model: modelInstance,
      messages: coreMessages,
      system: system?.trim() || undefined,
      tools: toolSet as unknown as ToolSet,
      temperature: 0.7,
      onChunk: ({ chunk }) => {
        if (chunk.type === "reasoning-delta") {
          console.log(`[CHAT V5] ip=${client.ip} | country=${client.country} | reasoning_delta=${chunk.text.length}`);
        } else if (chunk.type === "text-delta") {
          console.log(`[CHAT V5] ip=${client.ip} | country=${client.country} | text_delta=${chunk.text.length}`);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        if (error == null) return "Unknown error";
        if (typeof error === "string") return error;
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
      },
    });
  } catch (error) {
    console.error(
      `[CHAT V5 ERROR] ip=${client.ip} | country=${client.country} | error=${String(error)}`,
    );
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
