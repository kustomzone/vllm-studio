// CRITICAL
import { randomUUID } from "node:crypto";
import type { AppContext } from "../../types/context";
import { badRequest, notFound, serviceUnavailable } from "../../core/errors";
import { fetchInference } from "../../services/inference/inference-client";
import { COMPACTION_SYSTEM_PROMPT, COMPACTION_USER_PROMPT } from "./configs";

type MessageRecord = Record<string, unknown>;

export interface ChatCompactionOptions {
  model?: string;
  systemPrompt?: string;
  title?: string;
  preserveFirst?: boolean;
  preserveLast?: boolean;
}

export interface ChatCompactionResult {
  session: Record<string, unknown>;
  summary: string;
}

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" && !Number.isNaN(value) ? value : undefined;

const formatToolCalls = (toolCalls: unknown[]): string => {
  const formatted = toolCalls
    .map((call) => {
      if (!call || typeof call !== "object") return null;
      const record = call as Record<string, unknown>;
      const function_ = record["function"] as Record<string, unknown> | undefined;
      const name = getString(function_?.["name"]) ?? "tool";
      const args = getString(function_?.["arguments"]);
      const callLabel = args ? `${name}(${args})` : `${name}()`;
      const rawResult = record["result"];
      if (rawResult === undefined || rawResult === null) {
        return callLabel;
      }
      let resultText = "";
      let isError = false;
      if (typeof rawResult === "string") {
        resultText = rawResult;
      } else if (typeof rawResult === "object") {
        const resultRecord = rawResult as Record<string, unknown>;
        const content = getString(resultRecord["content"]);
        if (content) {
          resultText = content;
        } else {
          try {
            resultText = JSON.stringify(rawResult);
          } catch {
            resultText = String(rawResult);
          }
        }
        isError = resultRecord["isError"] === true;
      } else {
        resultText = String(rawResult);
      }
      if (!resultText) {
        return callLabel;
      }
      const errorSuffix = isError ? " (error)" : "";
      return `${callLabel} => ${resultText}${errorSuffix}`;
    })
    .filter((value): value is string => Boolean(value));
  return formatted.length > 0 ? `\n\n[Tool calls]: ${formatted.join("; ")}` : "";
};

const buildSummaryMessages = (
  messages: MessageRecord[]
): Array<{ role: string; content: string }> => {
  return messages
    .map((message) => {
      const role = getString(message["role"]) ?? "assistant";
      const content = getString(message["content"]) ?? "";
      const toolCalls = Array.isArray(message["tool_calls"]) ? message["tool_calls"] : [];
      const toolSuffix = toolCalls.length > 0 ? formatToolCalls(toolCalls) : "";
      const combined = `${content}${toolSuffix}`.trim();
      if (!combined) return null;
      return { role, content: combined };
    })
    .filter((value): value is { role: string; content: string } => Boolean(value));
};

const buildSystemPrompt = (systemPrompt?: string): string => {
  if (systemPrompt && systemPrompt.trim()) {
    return `${COMPACTION_SYSTEM_PROMPT}\n\nOriginal system prompt:\n${systemPrompt.trim()}`;
  }
  return COMPACTION_SYSTEM_PROMPT;
};

const resolveModel = (
  options: ChatCompactionOptions,
  session: MessageRecord,
  fallbackModel?: string
): string => {
  return options.model || getString(session["model"]) || fallbackModel || "default";
};

const requestSummary = async (
  context: AppContext,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> => {
  const response = await fetchInference(context, "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: COMPACTION_USER_PROMPT },
      ],
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw serviceUnavailable(`Compaction summary failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!summary) {
    throw badRequest("Compaction summary returned empty content");
  }
  return summary;
};

const createSummaryMessage = (summary: string, model?: string): MessageRecord => {
  const content = [
    `[Context compacted on ${new Date().toLocaleString()}]`,
    "",
    "The following is a summary of the prior conversation. All tasks described as completed have already been done — do NOT redo them.",
    "",
    summary,
  ].join("\n");
  return {
    role: "assistant",
    content,
    model: model ?? null,
    parts: [{ type: "text", text: content }],
  };
};

const pickFirstUserMessage = (messages: MessageRecord[]): MessageRecord | null =>
  messages.find((message) => getString(message["role"]) === "user") ?? null;

/**
 * Pick the last user/assistant exchange to preserve after the summary.
 * Returns a pair so the compacted session always ends with valid alternation.
 * If the conversation ends with an assistant message, return the preceding user + that assistant.
 * If it ends with a user message (no response yet), return only that user message.
 * Never returns a standalone assistant message (would create assistant→assistant after summary).
 */
const pickLastExchange = (
  messages: MessageRecord[],
  firstUser: MessageRecord | null,
): { lastUser: MessageRecord | null; lastAssistant: MessageRecord | null } => {
  if (messages.length === 0) return { lastUser: null, lastAssistant: null };

  const last = messages[messages.length - 1];
  if (!last) return { lastUser: null, lastAssistant: null };
  const lastRole = getString(last["role"]);

  if (lastRole === "assistant") {
    // Find the preceding user message for this assistant response
    let precedingUser: MessageRecord | null = null;
    for (let i = messages.length - 2; i >= 0; i--) {
      if (getString(messages[i]!["role"]) === "user") {
        precedingUser = messages[i]!;
        break;
      }
    }
    // Skip if the preceding user is the same as firstUser (already preserved)
    if (precedingUser && firstUser && precedingUser["id"] === firstUser["id"]) {
      precedingUser = null;
    }
    return { lastUser: precedingUser, lastAssistant: last };
  }

  if (lastRole === "user") {
    // Last message is user with no response — skip if same as firstUser
    if (firstUser && last["id"] === firstUser["id"]) {
      return { lastUser: null, lastAssistant: null };
    }
    return { lastUser: last, lastAssistant: null };
  }

  // tool/system/other — skip
  return { lastUser: null, lastAssistant: null };
};

const cloneMessageToSession = (
  context: AppContext,
  sessionId: string,
  message: MessageRecord
): void => {
  const role = getString(message["role"]) ?? "assistant";
  const content = getString(message["content"]) ?? undefined;
  const model = getString(message["model"]) ?? undefined;
  const toolCalls = Array.isArray(message["tool_calls"]) ? message["tool_calls"] : undefined;
  const toolCallId = getString(message["tool_call_id"]) ?? undefined;
  const toolName = getString(message["name"]) ?? undefined;
  const parts = Array.isArray(message["parts"]) ? message["parts"] : undefined;
  const metadata = Object.prototype.hasOwnProperty.call(message, "metadata")
    ? message["metadata"]
    : undefined;
  const promptTokens = getNumber(message["request_prompt_tokens"]);
  const toolsTokens = getNumber(message["request_tools_tokens"]);
  const totalInputTokens = getNumber(message["request_total_input_tokens"]);
  const completionTokens = getNumber(message["request_completion_tokens"]);

  context.stores.chatStore.addMessage(
    sessionId,
    randomUUID(),
    role,
    content,
    model,
    toolCalls,
    promptTokens,
    toolsTokens,
    totalInputTokens,
    completionTokens,
    parts,
    metadata,
    toolCallId,
    toolName
  );
};

export const compactChatSession = async (
  context: AppContext,
  sessionId: string,
  options: ChatCompactionOptions = {}
): Promise<ChatCompactionResult> => {
  const session = context.stores.chatStore.getSession(sessionId);
  if (!session) {
    throw notFound("Session not found");
  }

  const current = await context.processManager.findInferenceProcess(context.config.inference_port);
  if (!current) {
    throw serviceUnavailable("No model running");
  }

  const messages = Array.isArray(session["messages"])
    ? (session["messages"] as MessageRecord[])
    : [];
  if (messages.length === 0) {
    throw badRequest("Session has no messages to compact");
  }

  const summaryMessages = buildSummaryMessages(messages);
  if (summaryMessages.length === 0) {
    throw badRequest("Session messages are empty");
  }

  const systemPrompt = buildSystemPrompt(options.systemPrompt);
  const model = resolveModel(options, session, current.served_model_name ?? undefined);
  const summaryText = await requestSummary(context, model, systemPrompt, summaryMessages);

  const firstUser = options.preserveFirst === false ? null : pickFirstUserMessage(messages);
  const { lastUser, lastAssistant } =
    options.preserveLast === false
      ? { lastUser: null, lastAssistant: null }
      : pickLastExchange(messages, firstUser);

  const titleBase = getString(session["title"]) ?? "Chat";
  const newTitle = options.title ?? `${titleBase} (Compacted)`;
  const newSessionId = randomUUID();
  const agentState = Object.prototype.hasOwnProperty.call(session, "agent_state")
    ? session["agent_state"]
    : undefined;
  const newSession = context.stores.chatStore.createSession(
    newSessionId,
    newTitle,
    model,
    sessionId,
    agentState
  );

  // Build a valid alternating message sequence:
  //   [firstUser] → summary(assistant) → [lastUser → lastAssistant]
  if (firstUser) {
    cloneMessageToSession(context, newSessionId, firstUser);
  }

  const summaryMessage = createSummaryMessage(summaryText, model);
  cloneMessageToSession(context, newSessionId, summaryMessage);

  if (lastUser) {
    cloneMessageToSession(context, newSessionId, lastUser);
  }
  if (lastAssistant) {
    cloneMessageToSession(context, newSessionId, lastAssistant);
  }

  const hydrated = context.stores.chatStore.getSession(newSessionId) ?? newSession;

  return {
    session: hydrated,
    summary: summaryText,
  };
};
