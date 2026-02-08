// CRITICAL
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../config/env";
import type { AppContext } from "../types/context";
import { isHttpStatus } from "../core/errors";
import { ChatStore } from "../stores/chat-store";
import { JobStore } from "../stores/job-store";
import { ChatRunManager } from "../services/agent-runtime/run-manager";
import { JobManager } from "../services/jobs/job-manager";
import { MemoryJobsOrchestrator } from "../services/jobs/memory-orchestrator";
import { registerJobsRoutes } from "./jobs";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("Jobs routes", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    process.env["VLLM_STUDIO_MOCK_INFERENCE"] = "1";
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  const makeContext = (config: Config): AppContext => {
    const jobStore = new JobStore(config.db_path);
    const chatStore = new ChatStore(join(config.data_dir, "chats.db"));

    const baseContext = {
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
      runManager: null as unknown as ChatRunManager,
      serviceManager: {} as never,
      jobManager: null as unknown as JobManager,
      stores: {
        recipeStore: { list: mock(() => []) } as never,
        chatStore,
        downloadStore: {} as never,
        jobStore,
        peakMetricsStore: {} as never,
        lifetimeMetricsStore: { getAll: mock(() => ({})), increment: mock(() => undefined) } as never,
        mcpStore: {} as never,
      },
    } as unknown as AppContext;

    const runManager = new ChatRunManager(baseContext);
    (baseContext as unknown as { runManager: ChatRunManager }).runManager = runManager;

    const jobManager = new JobManager(baseContext, new MemoryJobsOrchestrator(baseContext));
    (baseContext as unknown as { jobManager: JobManager }).jobManager = jobManager;

    return baseContext;
  };

  it(
    "starts a voice_assistant_turn job and reaches completed (mock inference + mocked TTS CLI)",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "vllm-studio-jobs-"));
      const modelsDirectory = join(root, "models");
      const dataDirectory = join(root, "data");
      mkdirSync(join(modelsDirectory, "tts"), { recursive: true });
      mkdirSync(dataDirectory, { recursive: true });

      const ttsModel = "voice.onnx";
      writeFileSync(join(modelsDirectory, "tts", ttsModel), "x", "utf-8");

      const cliPath = join(root, "piper");
      writeFileSync(
        cliPath,
        `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "--version" ]]; then
  echo "piper-mock 0.0.0"
  exit 0
fi
out=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output_file" ]]; then out="$2"; shift 2; continue; fi
  shift
done
mkdir -p "$(dirname "$out")"
printf '\\x52\\x49\\x46\\x46' > "$out" # 'RIFF'
exit 0
`,
        "utf-8",
      );
      chmodSync(cliPath, 0o755);
      process.env["VLLM_STUDIO_TTS_CLI"] = cliPath;

      const config: Config = {
        host: "0.0.0.0",
        port: 8080,
        inference_port: 8000,
        temporal_address: "localhost:0",
        data_dir: dataDirectory,
        db_path: join(root, "controller.db"),
        models_dir: modelsDirectory,
      };

      const context = makeContext(config);
      const app = new Hono();
      registerJobsRoutes(app, context);
      app.onError((error, ctx) => {
        if (isHttpStatus(error)) return ctx.json({ detail: error.detail }, { status: error.status });
        return ctx.json({ detail: "Internal Server Error" }, { status: 500 });
      });

      const res = await app.request("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "voice_assistant_turn", input: { text: "hello", tts_model: ttsModel } }),
      });
      expect(res.status).toBe(200);
      const created = (await res.json()) as { job?: { id: string } };
      expect(created.job?.id).toBeTruthy();

      const jobId = created.job!.id;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const job = context.jobManager.getJob(jobId);
        if (job?.status === "completed") {
          expect(job.result?.["audio_base64"]).toBeTruthy();
          expect(job.result?.["audio_mime_type"]).toBe("audio/wav");
          return;
        }
        if (job?.status === "failed") {
          throw new Error(`job failed: ${job.error}`);
        }
        await sleep(50);
      }

      const job = context.jobManager.getJob(jobId);
      throw new Error(`job did not complete in time: ${JSON.stringify(job, null, 2)}`);
    },
    { timeout: 30_000 },
  );
});
