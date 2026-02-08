import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { Attachment } from "@/app/chat/types";
import { useChatSendUserMessage } from "./chat-send-user-message";

const apiMock = vi.hoisted(() => ({
  writeAgentFile: vi.fn(async () => ({ success: true })),
  streamOpenAIChatCompletions: vi.fn(async () => ({ stream: (async function* () {})() })),
  addChatMessage: vi.fn(async () => ({})),
}));

vi.mock("@/lib/api", () => ({ default: apiMock }));

describe("useChatSendUserMessage VLM routing", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  const waitFor = async (predicate: () => boolean, timeoutMs = 250) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS;
    delete process.env.VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS;
    apiMock.writeAgentFile.mockClear();
    apiMock.streamOpenAIChatCompletions.mockClear();
    apiMock.addChatMessage.mockClear();
    root?.unmount();
    root = null;
    container?.remove();
    container = null;
  });

  const makeImageAttachment = (): Attachment => ({
    id: "a1",
    type: "image",
    name: "image.png",
    size: 3,
    file: new File(["x"], "image.png", { type: "image/png" }),
    base64: "AAA",
  });

  it("when flag disabled, sends placeholders via /chats/:id/turn (no image parts)", async () => {
    const sendRef: { current: ((text: string, attachments?: Attachment[]) => Promise<void>) | null } = {
      current: null,
    };

    const messagesState: { value: ChatMessage[] } = { value: [] };
    const messagesRef = { current: messagesState.value };

    const startRunStream = vi.fn(async () => undefined);

    function Harness() {
      const { sendUserMessage } = useChatSendUserMessage({
        selectedModel: "model-1",
        systemPrompt: "",
        mcpEnabled: false,
        deepResearchEnabled: false,
        agentMode: true, // ensure we stay on agent runtime path
        currentSessionId: "s1",
        isLoading: false,
        messagesRef: messagesRef as unknown as React.MutableRefObject<ChatMessage[]>,
        runAbortControllerRef: { current: null },
        setIsLoading: () => {},
        agentFiles: [],
        agentFileVersions: {},
        setInput: () => {},
        setMessages: (next) => {
          messagesState.value =
            typeof next === "function" ? (next as (p: ChatMessage[]) => ChatMessage[])(messagesState.value) : next;
          messagesRef.current = messagesState.value;
        },
        setStreamError: () => {},
        setStreamingStartTime: () => {},
        lastUserInputRef: { current: "" },
        createSession: async () => ({ id: "s1" }),
        setLastSessionId: () => {},
        replaceUrlToSession: () => {},
        startRunStream,
        loadAgentFiles: () => {},
      });

      React.useEffect(() => {
        sendRef.current = async (text: string, attachments?: Attachment[]) =>
          sendUserMessage(text, attachments, { clearInput: false });
      }, [sendUserMessage]);
      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(React.createElement(Harness));
    await waitFor(() => sendRef.current !== null);
    expect(sendRef.current).not.toBeNull();

    await sendRef.current?.("", [makeImageAttachment()]);

    expect(startRunStream).toHaveBeenCalledTimes(1);
    const payload = startRunStream.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(typeof payload["content"]).toBe("string");
    expect(String(payload["content"])).toContain("[Image: image.png]");
    expect(payload["parts"]).toBeUndefined();
    expect(apiMock.streamOpenAIChatCompletions).not.toHaveBeenCalled();
  });

  it("when flag enabled and agent mode on, sends true multimodal parts via /chats/:id/turn", async () => {
    process.env.NEXT_PUBLIC_VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS = "1";

    const sendRef: { current: ((text: string, attachments?: Attachment[]) => Promise<void>) | null } = {
      current: null,
    };

    const messagesState: { value: ChatMessage[] } = { value: [] };
    const messagesRef = { current: messagesState.value };

    const startRunStream = vi.fn(async () => undefined);

    function Harness() {
      const { sendUserMessage } = useChatSendUserMessage({
        selectedModel: "model-1",
        systemPrompt: "",
        mcpEnabled: false,
        deepResearchEnabled: false,
        agentMode: true,
        currentSessionId: "s1",
        isLoading: false,
        messagesRef: messagesRef as unknown as React.MutableRefObject<ChatMessage[]>,
        runAbortControllerRef: { current: null },
        setIsLoading: () => {},
        agentFiles: [],
        agentFileVersions: {},
        setInput: () => {},
        setMessages: (next) => {
          messagesState.value =
            typeof next === "function" ? (next as (p: ChatMessage[]) => ChatMessage[])(messagesState.value) : next;
          messagesRef.current = messagesState.value;
        },
        setStreamError: () => {},
        setStreamingStartTime: () => {},
        lastUserInputRef: { current: "" },
        createSession: async () => ({ id: "s1" }),
        setLastSessionId: () => {},
        replaceUrlToSession: () => {},
        startRunStream,
        loadAgentFiles: () => {},
      });

      React.useEffect(() => {
        sendRef.current = async (text: string, attachments?: Attachment[]) =>
          sendUserMessage(text, attachments, { clearInput: false });
      }, [sendUserMessage]);

      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(React.createElement(Harness));
    await waitFor(() => sendRef.current !== null);
    expect(sendRef.current).not.toBeNull();

    await sendRef.current?.("hello", [makeImageAttachment()]);

    expect(startRunStream).toHaveBeenCalledTimes(1);
    const payload = startRunStream.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload["parts"]).toBeTruthy();
    expect(payload["content"]).toBe("hello");
    const parts = payload["parts"] as Array<Record<string, unknown>>;
    expect(parts.some((p) => p["type"] === "image")).toBe(true);
    expect(String(payload["content"])).not.toContain("[Image:");
    expect(apiMock.streamOpenAIChatCompletions).not.toHaveBeenCalled();
  });

  it("when flag enabled and agent mode off, uses direct OpenAI multimodal path", async () => {
    process.env.NEXT_PUBLIC_VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS = "1";

    const captured: { payload?: Record<string, unknown> } = {};
    apiMock.streamOpenAIChatCompletions.mockImplementationOnce(async (payload: Record<string, unknown>) => {
      captured.payload = payload;
      async function* gen() {
        yield { choices: [{ delta: { content: "ok" } }] };
        yield { choices: [{ delta: {} }] };
      }
      return { stream: gen() };
    });

    const sendRef: { current: ((text: string, attachments?: Attachment[]) => Promise<void>) | null } = {
      current: null,
    };

    const messagesState: { value: ChatMessage[] } = { value: [] };
    const messagesRef = { current: messagesState.value };

    const startRunStream = vi.fn(async () => undefined);

    function Harness() {
      const { sendUserMessage } = useChatSendUserMessage({
        selectedModel: "model-1",
        systemPrompt: "",
        mcpEnabled: false,
        deepResearchEnabled: false,
        agentMode: false,
        currentSessionId: "s1",
        isLoading: false,
        messagesRef: messagesRef as unknown as React.MutableRefObject<ChatMessage[]>,
        runAbortControllerRef: { current: null },
        setIsLoading: () => {},
        agentFiles: [],
        agentFileVersions: {},
        setInput: () => {},
        setMessages: (next) => {
          messagesState.value =
            typeof next === "function" ? (next as (p: ChatMessage[]) => ChatMessage[])(messagesState.value) : next;
          messagesRef.current = messagesState.value;
        },
        setStreamError: () => {},
        setStreamingStartTime: () => {},
        lastUserInputRef: { current: "" },
        createSession: async () => ({ id: "s1" }),
        setLastSessionId: () => {},
        replaceUrlToSession: () => {},
        startRunStream,
        loadAgentFiles: () => {},
      });

      React.useEffect(() => {
        sendRef.current = async (text: string, attachments?: Attachment[]) =>
          sendUserMessage(text, attachments, { clearInput: false });
      }, [sendUserMessage]);
      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(React.createElement(Harness));
    await waitFor(() => sendRef.current !== null);
    expect(sendRef.current).not.toBeNull();

    await sendRef.current?.("hello", [makeImageAttachment()]);

    expect(startRunStream).not.toHaveBeenCalled();
    expect(apiMock.streamOpenAIChatCompletions).toHaveBeenCalledTimes(1);
    expect(captured.payload?.model).toBe("model-1");
    expect(captured.payload?.stream).toBe(true);
    const messages = captured.payload?.messages as Array<Record<string, unknown>>;
    const last = messages[messages.length - 1] as Record<string, unknown>;
    expect(last["role"]).toBe("user");
    expect(Array.isArray(last["content"])).toBe(true);
    const parts = last["content"] as Array<Record<string, unknown>>;
    expect(parts.some((p) => p["type"] === "image_url")).toBe(true);
  });
});
