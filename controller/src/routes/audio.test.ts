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
import { ServiceManager } from "../services/service-manager";

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
      processManager: {
        findInferenceProcess: mock(() => Promise.resolve(null)),
        launchModel: mock(() => Promise.resolve({ success: false, pid: null, message: "not used", log_file: null })),
        evictModel: mock(() => Promise.resolve()),
      },
      downloadManager: {} as never,
      runManager: {} as never,
      serviceManager: {} as never,
      stores: {
        recipeStore: {
          list: mock(() => []),
          get: mock(() => null),
          save: mock(() => undefined),
          delete: mock(() => false),
        },
      } as never,
    } as unknown as AppContext;

    (context as unknown as { serviceManager: ServiceManager }).serviceManager = new ServiceManager(context);
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
if [[ "\${1:-}" == "--version" ]]; then
  echo "whisper-cli test"
  exit 0
fi
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

  it("STT: accepts browser audio/webm by transcoding with ffmpeg", async () => {
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
if [[ "\${1:-}" == "--version" ]]; then
  echo "whisper-cli test"
  exit 0
fi
prefix=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-of" ]]; then prefix="$2"; shift 2; continue; fi
  shift
done
echo "hello-webm" > "\${prefix}.txt"
exit 0
`,
      "utf-8",
    );
    chmodSync(cliPath, 0o755);
    process.env["VLLM_STUDIO_STT_CLI"] = cliPath;

    const ffmpegPath = join(root, "ffmpeg");
    writeFileSync(
      ffmpegPath,
      `#!/usr/bin/env bash
set -euo pipefail
in=""
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-i" ]]; then in="$2"; shift 2; continue; fi
  out="$1"
  shift
done
mkdir -p "$(dirname "$out")"
# Create a placeholder "wav" file. The STT adapter doesn't validate content in tests.
printf "RIFF" > "$out"
exit 0
`,
      "utf-8",
    );
    chmodSync(ffmpegPath, 0o755);
    process.env["PATH"] = `${root}:${process.env["PATH"] || ""}`;

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
    form.set("file", new File([new Uint8Array([1, 2, 3])], "recording.webm", { type: "audio/webm" }));

    const res = await app.request("/v1/audio/transcriptions", { method: "POST", body: form as unknown as BodyInit });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text).toBe("hello-webm");
  });

  it("STT: validates required file field", async () => {
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
if [[ "\${1:-}" == "--version" ]]; then
  echo "whisper-cli test"
  exit 0
fi
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
    const res = await app.request("/v1/audio/transcriptions", { method: "POST", body: form as unknown as BodyInit });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(String(json.detail)).toContain("Missing audio file field");
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
if [[ "\${1:-}" == "--version" ]]; then
  echo "piper test"
  exit 0
fi
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

  it("TTS: validates required input field", async () => {
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
if [[ "\${1:-}" == "--version" ]]; then
  echo "piper test"
  exit 0
fi
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
      body: JSON.stringify({ model: modelName }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(String(json.detail)).toContain("Missing 'input'");
  });

  it("TTS: returns gpu_lease_conflict when a different service holds the lease", async () => {
    const root = mkdtempSync(join(tmpdir(), "vllm-studio-audio-"));
    const modelsDirectory = join(root, "models");
    const dataDirectory = join(root, "data");
    mkdirSync(join(modelsDirectory, "tts"), { recursive: true });
    mkdirSync(join(modelsDirectory, "image"), { recursive: true });
    mkdirSync(dataDirectory, { recursive: true });

    writeFileSync(join(modelsDirectory, "tts", "voice.onnx"), "x", "utf-8");

    const piper = join(root, "piper");
    writeFileSync(
      piper,
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  echo "piper test"
  exit 0
fi
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
    chmodSync(piper, 0o755);

    const sd = join(root, "sd");
    writeFileSync(
      sd,
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  echo "sd test"
  exit 0
fi
exit 0
`,
      "utf-8",
    );
    chmodSync(sd, 0o755);

    process.env["VLLM_STUDIO_TTS_CLI"] = piper;
    process.env["VLLM_STUDIO_IMAGE_CLI"] = sd;
    // Simulate a GPU backend; this makes the TTS service require a GPU lease.
    process.env["VLLM_STUDIO_TTS_BACKEND"] = "cuda";

    const { app, context } = makeApp({
      host: "0.0.0.0",
      port: 8080,
      inference_port: 8000,
      temporal_address: "localhost:0",
      data_dir: dataDirectory,
      db_path: ":memory:",
      models_dir: modelsDirectory,
    });

    // Acquire the lease with a different service to force a conflict.
    await context.serviceManager.startService("image", { mode: "strict" });

    const res = await app.request("/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "voice.onnx", input: "hello", response_format: "wav" }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("gpu_lease_conflict");
  });
});
