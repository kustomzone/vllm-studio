// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { registerChatsRoutes } from "./chats";
import type { AppContext } from "../types/context";
import type { Config } from "../config/env";
import { ChatStore } from "../stores/chat-store";
import { ChatRunManager } from "../services/agent-runtime/run-manager";
import { isHttpStatus } from "../core/errors";

describe("POST /chats/:sessionId/turn parts", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    process.env["VLLM_STUDIO_MOCK_INFERENCE"] = "1";
    process.env["VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS"] = "1";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("accepts parts and persists image parts", async () => {
    const app = new Hono();

    const config: Config = {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: "/tmp",
      db_path: ":memory:",
      models_dir: "/models",
    };

    const chatStore = new ChatStore(":memory:");
    const sessionId = "session-1";
    chatStore.createSession(sessionId, "Test Chat", "test-model");

    const context = {
      config,
      stores: { chatStore },
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(null)),
      },
      eventManager: {
        publish: mock(() => Promise.resolve()),
      },
      logger: {
        info: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined),
        debug: mock(() => undefined),
      },
      metrics: {
        requestsTotal: { inc: mock(() => undefined) },
        requestDuration: { observe: mock(() => undefined) },
      },
      metricsRegistry: { metrics: mock(() => "") },
      launchState: {
        launching: null,
        setLaunching: mock(() => undefined),
        clearLaunching: mock(() => undefined),
      },
    } as unknown as AppContext;

    (context as unknown as { runManager: ChatRunManager }).runManager = new ChatRunManager(context);
    registerChatsRoutes(app, context);
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) {
        return ctx.json({ detail: error.detail }, { status: error.status });
      }
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    const res = await app.request(`/chats/${encodeURIComponent(sessionId)}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: "msg-1",
        parts: [
          { type: "text", text: "hi" },
          { type: "image", data: "AAA", mimeType: "image/png" },
        ],
        agent_mode: true,
      }),
    });

    expect(res.status).toBe(200);

    const session = chatStore.getSession(sessionId);
    const messages = (session?.["messages"] ?? []) as Array<Record<string, unknown>>;
    const user = messages.find((m) => m["id"] === "msg-1");
    expect(user).toBeTruthy();
    const parts = user?.["parts"] as unknown;
    expect(Array.isArray(parts)).toBe(true);
    expect((parts as Array<Record<string, unknown>>).some((p) => p["type"] === "image")).toBe(true);
  });
});

