// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerAudioRoutes } from "./audio";
import type { AppContext } from "../types/context";
import type { Config } from "../config/env";
import { isHttpStatus } from "../core/errors";

describe("Audio routes", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  const makeApp = (config: Config): { app: Hono; context: AppContext } => {
    const app = new Hono();
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
      processManager: {} as never,
      downloadManager: {} as never,
      runManager: {} as never,
      serviceManager: {} as never,
      stores: {} as never,
    } as unknown as AppContext;

    registerAudioRoutes(app, context);
    app.onError((error, ctx) => {
      if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
      return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
    });
    return { app, context };
  };

  it("STT: transcribes via CLI adapter", async () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-audio-"));
    const modelsDirectory = join(root, "models");
    const dataDirectory = join(root, "data");
    mkdirSync(join(modelsDirectory, "stt"), { recursive: true });
    mkdirSync(dataDirectory, { recursive: true });

    const modelName = "test.bin";
    writeFileSync(join(modelsDirectory, "stt", modelName), "x", "utf-8");

    const cliPath = join(root, "whisper-cli");
    writeFileSync(
      cliPath,
      `#!/usr/bin/env bash
set -euo pipefail
prefix=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-of" ]]; then prefix="$2"; shift 2; continue; fi
  shift
done
echo "hello" > "\${prefix}.txt"
exit 0
`,
      "utf-8",
    );
    chmodSync(cliPath, 0o755);

    process.env["VLLM_STUDIO_STT_CLI"] = cliPath;

    const { app } = makeApp({
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: dataDirectory,
      db_path: ":memory:",
      models_dir: modelsDirectory,
    });

    const form = new FormData();
    form.set("model", modelName);
    form.set("file", new File([new Uint8Array([1, 2, 3])], "sample.wav", { type: "audio/wav" }));

    const res = await app.request("/v1/audio/transcriptions", { method: "POST", body: form as unknown as BodyInit });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text).toBe("hello");
  });

  it("TTS: synthesizes wav via CLI adapter", async () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-audio-"));
    const modelsDirectory = join(root, "models");
    const dataDirectory = join(root, "data");
    mkdirSync(join(modelsDirectory, "tts"), { recursive: true });
    mkdirSync(dataDirectory, { recursive: true });

    const modelName = "voice.onnx";
    writeFileSync(join(modelsDirectory, "tts", modelName), "x", "utf-8");

    const cliPath = join(root, "piper");
    writeFileSync(
      cliPath,
      `#!/usr/bin/env bash
set -euo pipefail
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output_file" ]]; then out="$2"; shift 2; continue; fi
  shift
done
cat >/dev/null
mkdir -p "$(dirname "$out")"
printf "WAV" > "$out"
exit 0
`,
      "utf-8",
    );
    chmodSync(cliPath, 0o755);

    process.env["VLLM_STUDIO_TTS_CLI"] = cliPath;

    const { app } = makeApp({
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: dataDirectory,
      db_path: ":memory:",
      models_dir: modelsDirectory,
    });

    const res = await app.request("/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, input: "hello", response_format: "wav" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("audio/wav");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
});
