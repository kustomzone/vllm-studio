#!/usr/bin/env bun
// CRITICAL
/**
 * One-shot "make it work" runner for local UI + HotAisle controller tunnel.
 *
 * - Kills any listeners on :3006 and :18080
 * - Starts an SSH tunnel: localhost:18080 -> hotaisle VM :8080
 * - Starts Next dev server bound to 127.0.0.1:3006 with BACKEND_URL pointing at the tunnel
 *
 * Usage:
 *   bun vllm-studio/scripts/rockem/run-ui-3006.ts
 */

const BACKEND_TUNNEL_PORT = 18080;
const UI_PORT = 3006;
const UI_HOST = "127.0.0.1";
const SSH_TARGET = process.env["ROCKEM_SSH_TARGET"] ?? "hotaisle@23.183.40.67";
const FRONTEND_DIR = "/Users/sero/ai/amd/vllm-studio/frontend";
const FRONTEND_DATA_DIR = "/Users/sero/ai/amd/vllm-studio/frontend/data";

const run = async (argv: string[], opts?: { cwd?: string; env?: Record<string, string> }) => {
  const proc = Bun.spawn(argv, {
    cwd: opts?.cwd,
    env: { ...process.env, ...(opts?.env ?? {}) },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Command failed (${code}): ${argv.join(" ")}`);
};

const runQuiet = async (argv: string[], opts?: { cwd?: string; env?: Record<string, string> }): Promise<number> => {
  const proc = Bun.spawn(argv, {
    cwd: opts?.cwd,
    env: { ...process.env, ...(opts?.env ?? {}) },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  return await proc.exited;
};

const findListeners = async (port: number): Promise<number[]> => {
  const proc = Bun.spawn(["lsof", "-tiTCP:" + String(port), "-sTCP:LISTEN"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number.parseInt(line, 10))
    .filter((pid) => Number.isFinite(pid));
};

const killListeners = async (port: number): Promise<void> => {
  const pids = await findListeners(port);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
  }
  // small grace period, then hard kill if still around
  await new Promise((r) => setTimeout(r, 300));
  const remaining = await findListeners(port);
  for (const pid of remaining) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
};

const main = async (): Promise<void> => {
  await run(["mkdir", "-p", FRONTEND_DATA_DIR]);

  await killListeners(UI_PORT);
  await killListeners(BACKEND_TUNNEL_PORT);

  // Start tunnel in background (-f) with no remote command (-N) and no TTY (-T).
  await run([
    "ssh",
    "-oStrictHostKeyChecking=accept-new",
    "-oExitOnForwardFailure=yes",
    "-fNT",
    "-L",
    `${BACKEND_TUNNEL_PORT}:127.0.0.1:8080`,
    SSH_TARGET,
  ]);

  // Verify controller is reachable before starting UI.
  const healthExit = await runQuiet(["curl", "-fsS", `http://${UI_HOST}:${BACKEND_TUNNEL_PORT}/health`]);
  if (healthExit !== 0) {
    throw new Error(`Backend tunnel is not healthy at http://${UI_HOST}:${BACKEND_TUNNEL_PORT}/health`);
  }

  console.log(`Backend: http://${UI_HOST}:${BACKEND_TUNNEL_PORT}`);
  console.log(`UI:      http://${UI_HOST}:${UI_PORT}`);

  await run(
    [
      "npm",
      "--prefix",
      FRONTEND_DIR,
      "run",
      "dev",
      "--",
      "--hostname",
      UI_HOST,
      "--port",
      String(UI_PORT),
    ],
    {
      env: {
        VLLM_STUDIO_DATA_DIR: FRONTEND_DATA_DIR,
        BACKEND_URL: `http://${UI_HOST}:${BACKEND_TUNNEL_PORT}`,
      },
    },
  );
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

