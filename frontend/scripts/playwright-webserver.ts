// CRITICAL
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const sleep = (ms: number): Promise<void> => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const waitForUrl = async (
  url: string,
  options: { timeoutMs: number; intervalMs: number },
): Promise<void> => {
  const start = Date.now();
  while (true) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // ignore
    }
    if (Date.now() - start > options.timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await sleep(options.intervalMs);
  }
};

const frontendDir = process.cwd();
const repoRoot = resolve(frontendDir, "..");
const controllerDir = resolve(repoRoot, "controller");

const tempRoot = mkdtempSync(join(tmpdir(), "vllm-studio-playwright-"));
const dataDir = join(tempRoot, "data");
const modelsDir = join(tempRoot, "models");
mkdirSync(dataDir, { recursive: true });
mkdirSync(modelsDir, { recursive: true });

const controllerEnv: NodeJS.ProcessEnv = {
  ...process.env,
  VLLM_STUDIO_HOST: "127.0.0.1",
  VLLM_STUDIO_PORT: "8080",
  VLLM_STUDIO_INFERENCE_PORT: process.env.VLLM_STUDIO_INFERENCE_PORT ?? "8000",
  VLLM_STUDIO_DATA_DIR: dataDir,
  VLLM_STUDIO_DB_PATH: join(dataDir, "controller.db"),
  VLLM_STUDIO_MODELS_DIR: modelsDir,
  // E2E-friendly deterministic responses (no GPU/backends needed).
  VLLM_STUDIO_MOCK_INFERENCE: process.env.VLLM_STUDIO_MOCK_INFERENCE ?? "1",
  VLLM_STUDIO_MOCK_MODEL_ID: process.env.VLLM_STUDIO_MOCK_MODEL_ID ?? "mock",
  // Keep Temporal optional during UI E2E. The controller will surface availability via SSE/health.
  VLLM_STUDIO_TEMPORAL_ADDRESS: process.env.VLLM_STUDIO_TEMPORAL_ADDRESS ?? "localhost:7233",
};

const nextEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: "3000",
  NEXT_TELEMETRY_DISABLED: "1",
};

const controller = spawn("bun", ["src/main.ts"], {
  cwd: controllerDir,
  env: controllerEnv,
  stdio: "inherit",
});

const next = spawn("npm", ["run", "dev", "--", "-p", "3000"], {
  cwd: frontendDir,
  env: nextEnv,
  stdio: "inherit",
});

const shutdown = (signal: NodeJS.Signals): void => {
  if (controller.exitCode === null) controller.kill(signal);
  if (next.exitCode === null) next.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

controller.on("exit", (code) => {
  if (code && code !== 0) process.exit(code);
});
next.on("exit", (code) => {
  if (code && code !== 0) process.exit(code);
});

await waitForUrl("http://127.0.0.1:8080/health", { timeoutMs: 120_000, intervalMs: 250 });
await waitForUrl("http://127.0.0.1:3000", { timeoutMs: 120_000, intervalMs: 250 });

// Keep process alive until Playwright stops the webServer command.
while (true) {
  await sleep(1000);
}
