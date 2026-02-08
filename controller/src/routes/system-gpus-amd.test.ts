// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerSystemRoutes } from "./system";
import type { AppContext } from "../types/context";
import type { Config } from "../config/env";

describe("GET /gpus (amd-smi)", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("returns AMD GPU info when amd-smi is available", async () => {
    const directory = mkdtempSync(join(tmpdir(), "vllm-studio-amd-smi-"));
    const bin = join(directory, "amd-smi");
    const script = `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "metric" ]]; then
  cat <<'JSON'
{"gpu_data":[{"gpu":0,"mem_usage":{"total_vram":{"value":24576,"unit":"MB"},"used_vram":{"value":1024,"unit":"MB"},"free_vram":{"value":23552,"unit":"MB"}},"usage":{"gfx_activity":{"value":7,"unit":"%"}}, "temperature":{"edge":{"value":55,"unit":"C"}}, "power":{"socket_power":{"value":120,"unit":"W"}}}]}
JSON
  exit 0
fi
if [[ "$1" == "static" ]]; then
  cat <<'JSON'
{"gpu_data":[{"gpu":0,"asic":{"market_name":"AMD Instinct MI300X","target_graphics_version":"gfx942"}}]}
JSON
  exit 0
fi
echo "unknown command" >&2
exit 2
`;
    writeFileSync(bin, script, "utf-8");
    chmodSync(bin, 0o755);

    process.env["VLLM_STUDIO_GPU_SMI_TOOL"] = "amd-smi";
    process.env["AMD_SMI_PATH"] = bin;

    const app = new Hono();
    const mockConfig: Config = {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:7233",
      data_dir: "./data",
      db_path: ":memory:",
      models_dir: "/models",
    };

    const mockContext = {
      config: mockConfig,
      logger: {
        info: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined),
        debug: mock(() => undefined),
      },
      eventManager: {
        subscribe: mock(() => undefined),
        broadcast: mock(() => undefined),
      },
      launchState: {
        launching: null,
        setLaunching: mock(() => undefined),
        clearLaunching: mock(() => undefined),
      },
      metrics: {
        requestsTotal: { inc: mock(() => undefined) },
        requestDuration: { observe: mock(() => undefined) },
      },
      metricsRegistry: {
        metrics: mock(() => ""),
      },
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(null)),
        launchModel: mock(() => undefined),
        evictModel: mock(() => undefined),
      },
      serviceManager: { listServices: mock(() => Promise.resolve([])), getGpuLease: mock(() => null) },
      stores: {
        recipeStore: {
          list: mock(() => []),
          get: mock(() => undefined),
          save: mock(() => undefined),
          delete: mock(() => undefined),
        },
        chatStore: {
          listSessions: mock(() => []),
          getSession: mock(() => undefined),
          createSession: mock(() => undefined),
          deleteSession: mock(() => undefined),
        },
        peakMetricsStore: {
          get: mock(() => undefined),
          update: mock(() => undefined),
          list: mock(() => []),
        },
        lifetimeMetricsStore: {
          getAll: mock(() => ({})),
          addTokens: mock(() => undefined),
          addPromptTokens: mock(() => undefined),
          addCompletionTokens: mock(() => undefined),
          addRequests: mock(() => undefined),
          increment: mock(() => undefined),
        },
        mcpStore: {
          list: mock(() => []),
          get: mock(() => undefined),
          save: mock(() => undefined),
          delete: mock(() => undefined),
        },
      },
    } as unknown as AppContext;

    registerSystemRoutes(app, mockContext);

    const res = await app.request("/gpus");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.gpus)).toBe(true);
    expect(json.gpus.length).toBe(1);
    expect(json.gpus[0].name).toBe("AMD Instinct MI300X");
  });
});
