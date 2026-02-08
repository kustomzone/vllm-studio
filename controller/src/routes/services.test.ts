// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { registerServicesRoutes } from "./services";
import type { AppContext } from "../types/context";
import type { Config } from "../config/env";
import { ServiceManager } from "../services/service-manager";
import { isHttpStatus } from "../core/errors";

describe("Services Routes", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    process.env["VLLM_STUDIO_STT_CLI"] = "true";
    process.env["VLLM_STUDIO_IMAGE_CLI"] = "true";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  const makeContext = (): AppContext => {
    const config: Config = {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: "/tmp",
      db_path: "/tmp/controller.db",
      models_dir: "/models",
    };

    const context = {
      config,
      logger: {
        info: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined),
        debug: mock(() => undefined),
      },
      eventManager: {
        publish: mock(() => Promise.resolve()),
      },
      launchState: {} as never,
      metrics: {} as never,
      metricsRegistry: {} as never,
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(null)),
        evictModel: mock(() => Promise.resolve(null)),
        launchModel: mock(() => Promise.resolve({ success: true, pid: 123, message: "", log_file: null })),
      },
      downloadManager: {} as never,
      runManager: {} as never,
      stores: {
        recipeStore: { get: mock(() => null) } as never,
        chatStore: {} as never,
        downloadStore: {} as never,
        peakMetricsStore: {} as never,
        lifetimeMetricsStore: {} as never,
        mcpStore: {} as never,
      },
    } as unknown as AppContext;

    const serviceManager = new ServiceManager(context);
    (context as unknown as { serviceManager: ServiceManager }).serviceManager = serviceManager;
    return context;
  };

  it("lists services on fresh boot", async () => {
    const app = new Hono();
    registerServicesRoutes(app, makeContext());
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    const res = await app.request("/services");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.services)).toBe(true);
    expect(json.services.some((s: { id?: string }) => s.id === "stt")).toBe(true);
  });

  it("starts and stops a non-LLM service", async () => {
    const app = new Hono();
    registerServicesRoutes(app, makeContext());
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    const start = await app.request("/services/stt/start", { method: "POST", body: JSON.stringify({}) });
    expect(start.status).toBe(200);
    const started = await start.json();
    expect(started.service.status).toBe("ready");

    const stop = await app.request("/services/stt/stop", { method: "POST" });
    expect(stop.status).toBe(200);
    const stopped = await stop.json();
    expect(stopped.service.status).toBe("stopped");
  });

  it("returns gpu_lease_conflict in strict mode", async () => {
    const app = new Hono();
    const context = makeContext();
    registerServicesRoutes(app, context);
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    const startImage = await app.request("/services/image/start", { method: "POST", body: JSON.stringify({}) });
    expect(startImage.status).toBe(200);

    const res = await app.request("/services/llm/start", { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("gpu_lease_conflict");
    expect(json.holder_service?.id).toBe("image");
    expect(json.requested_service?.id).toBe("llm");
  });

  it("supports replace flow (stop holder then start requested)", async () => {
    const app = new Hono();

    // Stateful process manager mock for llm lifecycle.
    let current: { pid: number; backend: string; model_path: string | null; port: number; served_model_name: string | null } | null = null;

    const config: Config = {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: "/tmp",
      db_path: "/tmp/controller.db",
      models_dir: "/models",
    };

    const context = {
      config,
      logger: {
        info: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined),
        debug: mock(() => undefined),
      },
      eventManager: { publish: mock(() => Promise.resolve()) },
      launchState: {} as never,
      metrics: {} as never,
      metricsRegistry: {} as never,
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(current)),
        evictModel: mock(() => {
          current = null;
          return Promise.resolve(null);
        }),
        launchModel: mock(() => {
          current = { pid: 999, backend: "vllm", model_path: "/models/test", port: 8000, served_model_name: "test" };
          return Promise.resolve({ success: true, pid: 999, message: "", log_file: null });
        }),
      },
      downloadManager: {} as never,
      runManager: {} as never,
      stores: {
        recipeStore: {
          get: mock(() =>
            ({
              id: "r1",
              name: "Test",
              model_path: "/models/test",
              backend: "vllm",
              env_vars: null,
              tensor_parallel_size: 1,
              pipeline_parallel_size: 1,
              max_model_len: 2048,
              gpu_memory_utilization: 0.9,
              kv_cache_dtype: "auto",
              max_num_seqs: 1,
              trust_remote_code: false,
              tool_call_parser: null,
              reasoning_parser: null,
              enable_auto_tool_choice: false,
              quantization: null,
              dtype: null,
              host: "0.0.0.0",
              port: 8000,
              served_model_name: null,
              python_path: null,
              extra_args: {},
              max_thinking_tokens: null,
              thinking_mode: "off",
            }),
          ),
        } as never,
        chatStore: {} as never,
        downloadStore: {} as never,
        peakMetricsStore: {} as never,
        lifetimeMetricsStore: {} as never,
        mcpStore: {} as never,
      },
    } as unknown as AppContext;

    const serviceManager = new ServiceManager(context);
    (context as unknown as { serviceManager: ServiceManager }).serviceManager = serviceManager;

    registerServicesRoutes(app, context);
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    // Hold lease with image.
    const startImage = await app.request("/services/image/start", { method: "POST", body: JSON.stringify({}) });
    expect(startImage.status).toBe(200);

    // Replace: stop image and start llm.
    const startLlm = await app.request("/services/llm/start?replace=1", {
      method: "POST",
      body: JSON.stringify({ recipe_id: "r1" }),
    });
    expect(startLlm.status).toBe(200);

    const list = await app.request("/services");
    const listJson = await list.json();
    expect(listJson.gpu_lease?.holder_service_id).toBe("llm");
  });
});
