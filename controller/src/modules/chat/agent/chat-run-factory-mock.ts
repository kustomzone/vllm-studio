import { randomUUID } from "node:crypto";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { AppContext } from "../../../types/context";
import { buildSystemPrompt } from "./system-prompt-builder";
import { resolveModel } from "./run-manager-model-resolver";
import type { ChatRunOptions, ChatRunStream } from "./run-manager-types";
import { AsyncQueue } from "../../../core/async";
import { createRunPublisher, createSseStream } from "./run-manager-sse";
import { AGENT_RUN_EVENT_TYPES } from "./contracts";
import { persistAssistantMessage } from "./run-manager-persistence";

export async function createMockChatRun(
  context: AppContext,
  session: Record<string, unknown>,
  options: ChatRunOptions,
  content: string
): Promise<ChatRunStream> {
  const sessionId = options.sessionId;
  const modelSelection = await resolveModel(context, session, options.model, options.provider);
  const requestModel = modelSelection.requestModel;
  const storedModel = modelSelection.storedModel;
  const systemPrompt = buildSystemPrompt(session, options.systemPrompt, options.agentMode ?? false);

  const runId = randomUUID();
  const userMessageId = options.messageId ?? randomUUID();

  context.stores.chatStore.addMessage(
    sessionId,
    userMessageId,
    "user",
    content,
    storedModel,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    [{ type: "text", text: content }],
    { runId }
  );

  const runOptions = {
    userMessageId,
    model: storedModel,
    status: "running",
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...(options.agentMode || options.agentFiles ? { toolsetId: "agent" } : {}),
  };

  context.stores.chatStore.createRun(runId, sessionId, runOptions);

  const queue = new AsyncQueue<string>(1024);
  const abort = new AbortController();
  const { publish } = createRunPublisher(context, { runId, sessionId, queue });

  const runPromise = (async (): Promise<void> => {
    publish(AGENT_RUN_EVENT_TYPES.RUN_START, {
      user_message_id: userMessageId,
      model: storedModel,
    });
    publish(AGENT_RUN_EVENT_TYPES.TURN_START, { turn_index: 0 });

    const assistantMessageId = randomUUID();
    const assistant: AssistantMessage = {
      role: "assistant",
      api: "mock",
      provider: "mock",
      model: requestModel,
      stopReason: "stop",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      content: [
        {
          type: "text",
          text:
            `Mock response (no inference):\\n\\n` +
            `You said: ${content}\\n\\n` +
            `Model: ${requestModel}` +
            (systemPrompt
              ? `\\nSystem prompt bytes: ${Buffer.byteLength(systemPrompt, "utf8")}`
              : ""),
        },
      ],
      timestamp: Date.now(),
    };

    publish(AGENT_RUN_EVENT_TYPES.MESSAGE_START, {
      message_id: assistantMessageId,
      message: assistant,
      turn_index: 0,
    });
    publish(AGENT_RUN_EVENT_TYPES.MESSAGE_END, {
      message_id: assistantMessageId,
      message: assistant,
      turn_index: 0,
    });

    persistAssistantMessage(context, {
      sessionId,
      messageId: assistantMessageId,
      assistant,
      toolResults: [],
      runId,
      turnIndex: 0,
    });

    publish(AGENT_RUN_EVENT_TYPES.TURN_END, {
      message_id: assistantMessageId,
      message: assistant,
      toolResults: [],
      turn_index: 0,
    });

    context.stores.chatStore.updateRun(runId, {
      status: "completed",
      finishedAt: new Date().toISOString(),
    });
    publish(AGENT_RUN_EVENT_TYPES.RUN_END, { status: "completed", error: null });
  })()
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      context.stores.chatStore.updateRun(runId, {
        status: "error",
        finishedAt: new Date().toISOString(),
      });
      publish(AGENT_RUN_EVENT_TYPES.RUN_END, { status: "error", error: message });
    })
    .finally(() => {
      queue.close();
    });

  return {
    runId,
    stream: createSseStream(queue, abort, runPromise),
  };
}
