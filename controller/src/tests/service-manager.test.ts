// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { AppContext } from "../types/context";
import type { Config } from "../config/env";
import { ServiceManager } from "../services/service-manager";

describe("ServiceManager", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
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
      } satisfies Config,
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
        findInferenceProcess: mock(() => Promise.resolve(null)),
        evictModel: mock(() => Promise.resolve(null)),
        launchModel: mock(() => Promise.resolve({ success: true, pid: 123, message: "", log_file: null })),
      },
      downloadManager: {} as never,
      runManager: {} as never,
      serviceManager: {} as never,
      stores: {
        recipeStore: { get: mock(() => null) } as never,
        chatStore: {} as never,
        downloadStore: {} as never,
        peakMetricsStore: {} as never,
        lifetimeMetricsStore: {} as never,
        mcpStore: {} as never,
      },
    } as unknown as AppContext);

  it("starts and stops a non-LLM service with idempotency", async () => {
    process.env["VLLM_STUDIO_STT_CLI"] = "true";
    const context = makeContext();
    const manager = new ServiceManager(context);

    const started = await manager.startService("stt");
    expect(started.id).toBe("stt");
    expect(started.status).toBe("ready");

    const startedAgain = await manager.startService("stt");
    expect(startedAgain.status).toBe("ready");

    const stopped = await manager.stopService("stt");
    expect(stopped.status).toBe("stopped");

    const stoppedAgain = await manager.stopService("stt");
    expect(stoppedAgain.status).toBe("stopped");
  });
});

