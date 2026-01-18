import type { ToolCall, ToolResult } from "@/lib/types";
import type { Message, OpenAIContentPart, OpenAIMessage } from "../utils";

interface BuildMessagesInput {
  messages: Message[];
  systemPrompt: string;
  mcpEnabled: boolean;
  mcpTools: Array<{
    server: string;
    name: string;
    description?: string;
  }>;
  parseThinking: (content: string) => { mainContent: string };
}

export function buildApiMessages({
  messages,
  systemPrompt,
  mcpEnabled,
  mcpTools,
  parseThinking,
}: BuildMessagesInput): OpenAIMessage[] {
  const apiMessages: OpenAIMessage[] = [];
  const sysContent = systemPrompt.trim();
  if (sysContent) apiMessages.push({ role: "system", content: sysContent });
  if (mcpEnabled && mcpTools.length > 0) {
    const toolsList = mcpTools
      .map((tool) => `- ${tool.server}__${tool.name}: ${tool.description || "No description"}`)
      .join("\n");
    apiMessages.push({
      role: "system",
      content: `Available tools:\n${toolsList}`,
    });
  }
  for (const msg of messages) {
    if (msg.role === "user") {
      const parts: OpenAIContentPart[] = [];
      if (msg.content) parts.push({ type: "text", text: msg.content });
      if (msg.images?.length)
        msg.images.forEach((img) =>
          parts.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${img}` },
          }),
        );
      apiMessages.push({
        role: "user",
        content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
      });
    } else {
      const cleanContent = parseThinking(msg.content).mainContent;
      if (msg.toolCalls?.length) {
        apiMessages.push({
          role: "assistant",
          content: cleanContent || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });
        msg.toolResults?.forEach((tr) =>
          apiMessages.push({
            role: "tool",
            tool_call_id: tr.tool_call_id,
            content: tr.content,
          }),
        );
      } else {
        apiMessages.push({ role: "assistant", content: cleanContent || "" });
      }
    }
  }
  return apiMessages;
}

interface StreamState {
  assistantMsgId: string;
  iterationContent: string;
  toolCalls: ToolCall[];
  pendingContent: string;
  pendingToolCalls: ToolCall[] | null;
  frameId: number | null;
}

interface StreamUpdateHandlers {
  updateMessages: (updater: (messages: Message[]) => Message[]) => void;
}

export function createStreamState(assistantMsgId: string): StreamState {
  return {
    assistantMsgId,
    iterationContent: "",
    toolCalls: [],
    pendingContent: "",
    pendingToolCalls: null,
    frameId: null,
  };
}

export function flushAssistantUpdate(state: StreamState, handlers: StreamUpdateHandlers, force = false) {
  const applyUpdate = () => {
    state.frameId = null;
    if (!state.pendingContent && !state.pendingToolCalls) return;
    handlers.updateMessages((prev) =>
      prev.map((m) =>
        m.id === state.assistantMsgId
          ? {
              ...m,
              content: state.pendingContent || state.iterationContent,
              toolCalls: state.pendingToolCalls ?? m.toolCalls,
            }
          : m,
      ),
    );
    state.pendingContent = "";
    state.pendingToolCalls = null;
  };

  if (force) {
    if (state.frameId !== null) window.cancelAnimationFrame(state.frameId);
    applyUpdate();
    return;
  }
  if (state.frameId === null) state.frameId = window.requestAnimationFrame(applyUpdate);
}

interface ToolExecutionContext {
  executeMCPTool: (toolCall: ToolCall) => Promise<ToolResult>;
  updateExecutingTools: (updater: (tools: Set<string>) => Set<string>) => void;
  updateToolResultsMap: (updater: (map: Map<string, ToolResult>) => Map<string, ToolResult>) => void;
}

export async function executeToolCalls(
  toolCalls: ToolCall[],
  cachedResults: Map<string, Omit<ToolResult, "tool_call_id">>,
  context: ToolExecutionContext,
): Promise<{ toolResults: ToolResult[]; toolNameByCallId: Map<string, string> }> {
  const toolResults: ToolResult[] = [];
  const toolNameByCallId = new Map<string, string>();

  for (const tc of toolCalls) {
    const signature = `${tc.function?.name}:${tc.function?.arguments}`;
    toolNameByCallId.set(tc.id, tc.function.name);
    if (cachedResults.has(signature)) {
      const cached = cachedResults.get(signature)!;
      toolResults.push({ tool_call_id: tc.id, ...cached });
      context.updateToolResultsMap((prev) => {
        const next = new Map(prev);
        next.set(tc.id, { tool_call_id: tc.id, ...cached });
        return next;
      });
      continue;
    }
    context.updateExecutingTools((prev) => {
      const next = new Set(prev);
      next.add(tc.id);
      return next;
    });
    const result = await context.executeMCPTool(tc);
    cachedResults.set(signature, {
      content: result.content,
      isError: result.isError,
    });
    toolResults.push(result);
    context.updateToolResultsMap((prev) => {
      const next = new Map(prev);
      next.set(tc.id, result);
      return next;
    });
    context.updateExecutingTools((prev) => {
      const next = new Set(prev);
      next.delete(tc.id);
      return next;
    });
  }

  return { toolResults, toolNameByCallId };
}
