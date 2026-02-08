// CRITICAL
import { describe, expect, it, mock } from "bun:test";
import { startMetricsCollector } from "../metrics-collector";
import { delay } from "../core/async";
import type { AppContext } from "../types/context";

describe("runtime_summary eventing", () => {
  it("publishes runtime_summary at least once", async () => {
    let resolvePublished: (() => void) | null = null;
    const published = new Promise<void>((resolve) => {
      resolvePublished = resolve;
    });

    const publishRuntimeSummary = mock(async () => {
      resolvePublished?.();
    });

    const context = {
      config: {
        host: "0.0.0.0",
        port: 8080,
        inference_port: 8000,
        temporal_address: "localhost:0",
        data_dir: "/tmp",
        db_path: "/tmp/controller.db",
        models_dir: "/models",
      },
      logger: {
        info: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined),
        debug: mock(() => undefined),
      },
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(null)),
      },
      metrics: {
        updateActiveModel: mock(() => undefined),
        updateGpuMetrics: mock(() => undefined),
        updateSseMetrics: mock(() => undefined),
      },
      stores: {
        lifetimeMetricsStore: {
          increment: mock(() => 0),
          getAll: mock(() => ({})),
        },
        peakMetricsStore: {
          updateIfBetter: mock(() => undefined),
          get: mock(() => null),
        },
      },
      eventManager: {
        publishStatus: mock(async () => undefined),
        publishGpu: mock(async () => undefined),
        publishMetrics: mock(async () => undefined),
        publishTemporalStatus: mock(async () => undefined),
        publishRuntimeSummary,
        getStats: mock(() => ({})),
      },
    } as unknown as AppContext;

    const stop = startMetricsCollector(context);

    await Promise.race([published, delay(10_000)]);
    stop();

    expect(publishRuntimeSummary).toHaveBeenCalled();
  });
});

