// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppContext } from "../types/context";
import type { Config } from "../config/env";
import { ServiceManager } from "../services/service-manager";
import { registerImagesRoutes } from "./images";
import { isHttpStatus } from "../core/errors";

describe("Image generation route", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  const makeContext = (config: Config, overrides?: Partial<AppContext>): AppContext => {
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
        findInferenceProcess: mock(() => Promise.resolve(null)),
        evictModel: mock(() => Promise.resolve(null)),
        launchModel: mock(() => Promise.resolve({ success: true, pid: 1, message: "", log_file: null })),
      },
      downloadManager: {} as never,
      runManager: {} as never,
      stores: { recipeStore: { get: mock(() => null) } as never } as never,
    } as unknown as AppContext;

    if (overrides) {
      Object.assign(context as unknown as Record<string, unknown>, overrides as unknown as Record<string, unknown>);
    }

    const serviceManager = new ServiceManager(context);
    (context as unknown as { serviceManager: ServiceManager }).serviceManager = serviceManager;
    return context;
  };

  it("returns a base64 image payload from a CLI adapter", async () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-image-"));
    const modelsDirectory = join(root, "models");
    const dataDirectory = join(root, "data");
    mkdirSync(join(modelsDirectory, "image"), { recursive: true });
    mkdirSync(dataDirectory, { recursive: true });

    const modelName = "model.gguf";
    writeFileSync(join(modelsDirectory, "image", modelName), "x", "utf-8");

    const cliPath = join(root, "sd");
    writeFileSync(
      cliPath,
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "--version" ]]; then
  echo "sd-mock 0.0.0"
  exit 0
fi
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then out="$2"; shift 2; continue; fi
  shift
done
mkdir -p "$(dirname "$out")"
printf '\\x89PNG\\r\\n\\x1a\\n' > "$out"
exit 0
`,
      "utf-8",
    );
    chmodSync(cliPath, 0o755);

    process.env["VLLM_STUDIO_IMAGE_CLI"] = cliPath;

    const config: Config = {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: dataDirectory,
      db_path: ":memory:",
      models_dir: modelsDirectory,
    };

    const context = makeContext(config);
    const app = new Hono();
    registerImagesRoutes(app, context);
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });

    const res = await app.request("/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", model: modelName, width: 64, height: 64, steps: 1 }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.data[0]?.b64_json).toBe("string");
  });

  it("returns gpu_lease_conflict when llm holds the lease in strict mode", async () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-image-"));
    const modelsDirectory = join(root, "models");
    const dataDirectory = join(root, "data");
    mkdirSync(join(modelsDirectory, "image"), { recursive: true });
    mkdirSync(dataDirectory, { recursive: true });

    const modelName = "model.gguf";
    writeFileSync(join(modelsDirectory, "image", modelName), "x", "utf-8");

    const cliPath = join(root, "sd");
    writeFileSync(cliPath, "#!/usr/bin/env bash\nexit 0\n", "utf-8");
    chmodSync(cliPath, 0o755);
    process.env["VLLM_STUDIO_IMAGE_CLI"] = cliPath;

    const config: Config = {
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: dataDirectory,
      db_path: ":memory:",
      models_dir: modelsDirectory,
    };

    const context = makeContext(config, {
      processManager: {
        findInferenceProcess: mock(() =>
          Promise.resolve({ pid: 1, backend: "vllm", model_path: "/models/x", port: 8000, served_model_name: "x" }),
        ),
        evictModel: mock(() => Promise.resolve(null)),
        launchModel: mock(() => Promise.resolve({ success: true, pid: 1, message: "", log_file: null })),
      } as never,
    });

    await context.serviceManager.listServices(); // refresh llm state + lease

    const app = new Hono();
    registerImagesRoutes(app, context);

    const res = await app.request("/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", model: modelName }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("gpu_lease_conflict");
    expect(json.holder_service?.id).toBe("llm");
    expect(json.requested_service?.id).toBe("image");
  });
});
