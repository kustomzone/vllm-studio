#!/usr/bin/env bun
// CRITICAL
/**
 * One-shot runner: local UI + two backends (pipeline split).
 *
 * Goal: split GPU-heavy work across two machines to avoid lease contention.
 * - Backend (LLM/chat controller): NVIDIA host (ser@192.168.1.70)
 * - Voice + Media (STT/TTS + image generation): AMD HotAisle VM (hotaisle@23.183.40.84)
 *
 * Tunnels created:
 * - localhost:18081 -> NVIDIA controller :8080  (BACKEND_URL)
 * - localhost:18080 -> AMD controller    :8080  (VOICE_URL + MEDIA_URL)
 *
 * Usage:
 *   bun vllm-studio/scripts/rockem/run-ui-3006-split.ts
 *
 * Env overrides:
 * - ROCKEM_AMD_SSH_TARGET=hotaisle@23.183.40.84
 * - ROCKEM_NVIDIA_SSH_TARGET=ser@192.168.1.70
 * - ROCKEM_NVIDIA_SSH_IDENTITY=~/.ssh/linux-ai
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

const AMD_TUNNEL_PORT = 18080;
const NVIDIA_TUNNEL_PORT = 18081;
const UI_PORT = 3006;
const UI_HOST = "127.0.0.1";

const AMD_SSH_TARGET = process.env["ROCKEM_AMD_SSH_TARGET"] ?? process.env["ROCKEM_SSH_TARGET"] ?? "hotaisle@23.183.40.84";
const NVIDIA_SSH_TARGET = process.env["ROCKEM_NVIDIA_SSH_TARGET"] ?? "ser@192.168.1.70";
const NVIDIA_SSH_IDENTITY = process.env["ROCKEM_NVIDIA_SSH_IDENTITY"] ?? resolvePath(process.env.HOME || "", ".ssh", "linux-ai");
const KEEP_AMD_LLM =
  (process.env["ROCKEM_AMD_KEEP_LLM"] ?? "").trim() === "1" ||
  (process.env["ROCKEM_AMD_KEEP_LLM"] ?? "").trim().toLowerCase() === "true";

const FRONTEND_DIR = "/Users/sero/ai/amd/vllm-studio/frontend";
const FRONTEND_DATA_DIR = "/Users/sero/ai/amd/vllm-studio/frontend/data";
const SETTINGS_PATH = resolvePath(FRONTEND_DATA_DIR, "api-settings.json");

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

const startTunnel = async (args: {
  localPort: number;
  sshTarget: string;
  identityFile?: string;
}): Promise<void> => {
  const baseArgs = [
    "ssh",
    "-oStrictHostKeyChecking=accept-new",
    "-oExitOnForwardFailure=yes",
    "-fNT",
  ];
  if (args.identityFile) {
    baseArgs.push("-i", args.identityFile);
  }
  baseArgs.push("-L", `${args.localPort}:127.0.0.1:8080`, args.sshTarget);
  await run(baseArgs);
};

const writeSettings = (args: { backendUrl: string; voiceUrl: string; mediaUrl: string }) => {
  try {
    mkdirSync(FRONTEND_DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
  writeFileSync(
    SETTINGS_PATH,
    JSON.stringify(
      {
        backendUrl: args.backendUrl,
        apiKey: "",
        voiceUrl: args.voiceUrl,
        voiceModel: "whisper-large-v3-turbo",
        mediaUrl: args.mediaUrl,
      },
      null,
      2,
    ),
    "utf-8",
  );
};

const main = async (): Promise<void> => {
  await killListeners(UI_PORT);
  await killListeners(AMD_TUNNEL_PORT);
  await killListeners(NVIDIA_TUNNEL_PORT);

  await startTunnel({ localPort: AMD_TUNNEL_PORT, sshTarget: AMD_SSH_TARGET });
  await startTunnel({ localPort: NVIDIA_TUNNEL_PORT, sshTarget: NVIDIA_SSH_TARGET, identityFile: NVIDIA_SSH_IDENTITY });

  const amdHealthExit = await runQuiet(["curl", "-fsS", `http://${UI_HOST}:${AMD_TUNNEL_PORT}/health`]);
  if (amdHealthExit !== 0) throw new Error(`AMD backend tunnel unhealthy: http://${UI_HOST}:${AMD_TUNNEL_PORT}/health`);

  const nvidiaHealthExit = await runQuiet(["curl", "-fsS", `http://${UI_HOST}:${NVIDIA_TUNNEL_PORT}/health`]);
  if (nvidiaHealthExit !== 0) throw new Error(`NVIDIA backend tunnel unhealthy: http://${UI_HOST}:${NVIDIA_TUNNEL_PORT}/health`);

  const backendUrl = `http://${UI_HOST}:${NVIDIA_TUNNEL_PORT}`;
  const voiceUrl = `http://${UI_HOST}:${AMD_TUNNEL_PORT}`;
  const mediaUrl = `http://${UI_HOST}:${AMD_TUNNEL_PORT}`;

  // When LLM lives on the NVIDIA box, stop the AMD LLM to avoid strict GPU lease conflicts
  // that would otherwise block TTS/STT or image generation on the AMD VM.
  if (!KEEP_AMD_LLM) {
    await runQuiet(["curl", "-fsS", "-X", "POST", `${voiceUrl}/services/llm/stop`, "-H", "content-type: application/json", "-d", "{}"]);
  }

  writeSettings({ backendUrl, voiceUrl, mediaUrl });

  console.log(`Backend (LLM/controller): ${backendUrl}`);
  console.log(`Voice  (STT/TTS):         ${voiceUrl}`);
  console.log(`Media  (images/video):    ${mediaUrl}`);
  console.log(`UI:                      http://${UI_HOST}:${UI_PORT}`);

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
        BACKEND_URL: backendUrl,
        VOICE_URL: voiceUrl,
        MEDIA_URL: mediaUrl,
      },
    },
  );
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
