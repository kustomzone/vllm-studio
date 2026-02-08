// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { registerOpenAIRoutes } from "./openai";
import type { AppContext } from "../types/context";
import { isHttpStatus } from "../core/errors";

describe("OpenAI multimodal forwarding", () => {
  const originalEnvironment = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    globalThis.fetch = originalFetch;
  });

  const makeContext = (): AppContext =>
    ({
      config: {
        host: "0.0.0.0",
        port: 8080,
        inference_port: 8000,
        temporal_address: "localhost:0",
        data_dir: "/tmp",
        db_path: "/tmp/controller.db",
        models_dir: "/models",
      },
      stores: {
        recipeStore: { list: mock(() => []) },
        lifetimeMetricsStore: {
          addPromptTokens: mock(() => undefined),
          addCompletionTokens: mock(() => undefined),
          addTokens: mock(() => undefined),
          addRequests: mock(() => undefined),
        },
      },
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(null)),
        evictModel: mock(() => Promise.resolve({ success: true })),
        launchModel: mock(() => Promise.resolve({ success: true, pid: 123, message: "", log_file: null })),
      },
      eventManager: { publish: mock(() => Promise.resolve()) },
    } as unknown as AppContext);

  it("rejects image_url parts when feature flag is disabled", async () => {
    delete process.env["VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS"];
    const app = new Hono();
    registerOpenAIRoutes(app, makeContext());
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) {
        return ctx.json({ detail: error.detail }, { status: error.status });
      }
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "test",
        stream: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "hi" },
              { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
            ],
          },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS");
  });

  it("forwards image_url parts unchanged when feature flag is enabled", async () => {
    process.env["VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS"] = "1";
    const app = new Hono();
    registerOpenAIRoutes(app, makeContext());
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) {
        return ctx.json({ detail: error.detail }, { status: error.status });
      }
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    let capturedBody: string | null = null;
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      const body = init?.body;
      if (body instanceof ArrayBuffer) {
        capturedBody = new TextDecoder().decode(body);
      } else if (typeof body === "string") {
        capturedBody = body;
      } else if (body) {
        capturedBody = String(body);
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller): void {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    }) as unknown as typeof fetch;

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "test",
        stream: true,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "hi" },
              { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
            ],
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    expect(capturedBody).toBeTruthy();
    expect(capturedBody ?? "").toContain("\"image_url\"");
  });
});
