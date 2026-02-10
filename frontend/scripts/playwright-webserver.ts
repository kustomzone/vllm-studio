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

const resolveUiPort = (): string => {
  const explicit = process.env.PLAYWRIGHT_UI_PORT ?? process.env.PORT;
  if (explicit) return explicit;

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      if (url.port) return url.port;
    } catch {
      // ignore
    }
  }

  return "3000";
};

const uiPort = resolveUiPort();

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
  PORT: uiPort,
  NEXT_TELEMETRY_DISABLED: "1",
  // Force the UI to use the ephemeral E2E controller, not any developer-local BACKEND_URL or settings file.
  BACKEND_URL: "http://127.0.0.1:8080",
  VLLM_STUDIO_DATA_DIR: dataDir,
  // E2E: avoid requiring real mic + voice binaries.
  NEXT_PUBLIC_VLLM_STUDIO_E2E_FAKE_MIC: process.env.NEXT_PUBLIC_VLLM_STUDIO_E2E_FAKE_MIC ?? "1",
  VLLM_STUDIO_MOCK_VOICE: process.env.VLLM_STUDIO_MOCK_VOICE ?? "1",
};

const controller = spawn("bun", ["src/main.ts"], {
  cwd: controllerDir,
  env: controllerEnv,
  stdio: "inherit",
});

const next = spawn("npm", ["run", "dev", "--", "-p", uiPort], {
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
await waitForUrl(`http://127.0.0.1:${uiPort}`, { timeoutMs: 120_000, intervalMs: 250 });

// Keep process alive until Playwright stops the webServer command.
while (true) {
  await sleep(1000);
}
