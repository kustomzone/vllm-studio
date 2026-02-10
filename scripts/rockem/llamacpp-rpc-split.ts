#!/usr/bin/env bun
// CRITICAL
/**
 * Bring up a Parallax-style cross-host split using llama.cpp RPC:
 * - AMD VM runs rpc-server (HIP/ROCm)
 * - NVIDIA host runs vLLM Studio controller and launches llama-server with --rpc pointing at AMD
 *
 * This is an operator script. It’s best-effort and makes pragmatic assumptions:
 * - rpc-server listens on a port reachable from the NVIDIA host (public IP or LAN)
 * - The NVIDIA controller is already running on :8080
 *
 * Usage (defaults match earlier notes):
 *   bun vllm-studio/scripts/rockem/llamacpp-rpc-split.ts
 *
 * Env overrides:
 * - ROCKEM_AMD_SSH_TARGET=hotaisle@23.183.40.84
 * - ROCKEM_AMD_RPC_HOST=23.183.40.84
 * - ROCKEM_AMD_RPC_PORT=50052
 * - ROCKEM_AMD_RPC_MEM_MB=16000
 * - ROCKEM_NVIDIA_SSH_TARGET=ser@192.168.1.70
 * - ROCKEM_NVIDIA_SSH_IDENTITY=~/.ssh/linux-ai
 * - ROCKEM_RECIPE_ID=qwen-llamacpp-rpc-split
 * - ROCKEM_SERVED_MODEL_NAME=qwen-rpc
 * - ROCKEM_TENSOR_SPLIT=1,1
 *
 * What it does:
 * - Starts (or restarts) rpc-server on AMD
 * - Finds a reasonable GGUF model path on NVIDIA (prefers a currently-running llama.cpp recipe)
 * - Creates/updates a llama.cpp recipe on the NVIDIA controller with --rpc + layer split args
 * - Starts the LLM service (replace=1)
 */

import { resolve as resolvePath } from "node:path";

const AMD_SSH_TARGET = process.env["ROCKEM_AMD_SSH_TARGET"] ?? "hotaisle@23.183.40.84";
const AMD_RPC_HOST =
  process.env["ROCKEM_AMD_RPC_HOST"] ??
  (AMD_SSH_TARGET.includes("@") ? AMD_SSH_TARGET.split("@")[1] : AMD_SSH_TARGET);
const AMD_RPC_PORT = Number.parseInt(process.env["ROCKEM_AMD_RPC_PORT"] ?? "50052", 10);
const AMD_RPC_MEM_MB = Number.parseInt(process.env["ROCKEM_AMD_RPC_MEM_MB"] ?? "16000", 10);

const NVIDIA_SSH_TARGET = process.env["ROCKEM_NVIDIA_SSH_TARGET"] ?? "ser@192.168.1.70";
const NVIDIA_SSH_IDENTITY =
  process.env["ROCKEM_NVIDIA_SSH_IDENTITY"] ??
  resolvePath(process.env.HOME || "", ".ssh", "linux-ai");

const RECIPE_ID = process.env["ROCKEM_RECIPE_ID"] ?? "qwen-llamacpp-rpc-split";
const SERVED_MODEL_NAME = process.env["ROCKEM_SERVED_MODEL_NAME"] ?? "qwen-rpc-split";
const TENSOR_SPLIT = (process.env["ROCKEM_TENSOR_SPLIT"] ?? "1,1").trim();

const sshRun = async (args: string[]): Promise<void> => {
  const proc = Bun.spawn(args, { stdin: "ignore", stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Command failed (${code}): ${args.join(" ")}`);
};

const sshCapture = async (args: string[]): Promise<string> => {
  const proc = Bun.spawn(args, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${args.join(" ")}\n${err || out}`);
  }
  return out;
};

const main = async (): Promise<void> => {
  const rpcTarget = `${AMD_RPC_HOST}:${AMD_RPC_PORT}`;

  // 1) Start AMD rpc-server.
  await sshRun([
    "ssh",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ServerAliveInterval=20",
    "-o",
    "ServerAliveCountMax=3",
    AMD_SSH_TARGET,
    "bash",
    "-lc",
    [
      "set -euo pipefail",
      'echo \"[rpc] amd host: $(hostname)\"',
      "test -x ~/src/llama.cpp/build/bin/rpc-server",
      // Restart if already running.
      "if [ -f ~/llamacpp-rpc-server.pid ]; then kill \"$(cat ~/llamacpp-rpc-server.pid)\" >/dev/null 2>&1 || true; fi",
      "nohup ~/src/llama.cpp/build/bin/rpc-server " +
        `--host 0.0.0.0 --port ${AMD_RPC_PORT} --mem ${AMD_RPC_MEM_MB} ` +
        "> ~/llamacpp-rpc-server.log 2>&1 & echo $! > ~/llamacpp-rpc-server.pid",
      "sleep 1",
      `ss -ltn | grep -E \":${AMD_RPC_PORT}\\\\b\" || true`,
      `echo \"[rpc] up: ${rpcTarget}\"`,
    ].join("\n"),
  ]);

  // 2) Find a model path on NVIDIA.
  // Prefer: currently-running llama.cpp recipe on controller.
  const modelPath = await sshCapture([
    "ssh",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-i",
    NVIDIA_SSH_IDENTITY,
    NVIDIA_SSH_TARGET,
    "bash",
    "-lc",
    [
      "set -euo pipefail",
      "controller_url=http://127.0.0.1:8080",
      "recipes_json=$(curl -fsS \"$controller_url/recipes\")",
      // Pick a running llama.cpp recipe if present; else pick any llama.cpp recipe; else fallback to first .gguf in /models/llm.
      "mp=$(echo \"$recipes_json\" | jq -r '[ .[] | select(.backend==\"llamacpp\" and .status==\"running\") ][0].model_path // empty')",
      "if [ -z \"$mp\" ]; then mp=$(echo \"$recipes_json\" | jq -r '[ .[] | select(.backend==\"llamacpp\") ][0].model_path // empty'); fi",
      "if [ -z \"$mp\" ]; then mp=$(ls -1 /models/llm 2>/dev/null | grep -iE '\\\\.gguf$' | head -n 1 | sed 's#^#/models/llm/#'); fi",
      "if [ -z \"$mp\" ]; then echo \"\"; exit 2; fi",
      "echo \"$mp\"",
    ].join("\n"),
  ]);

  // 3) Create/update recipe + start service on NVIDIA controller.
  await sshRun([
    "ssh",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-i",
    NVIDIA_SSH_IDENTITY,
    NVIDIA_SSH_TARGET,
    "bash",
    "-lc",
    [
      "set -euo pipefail",
      "controller_url=http://127.0.0.1:8080",
      `model_path=${JSON.stringify(modelPath.trim())}`,
      `echo \"[rpc] using model_path=$model_path\"`,
      "tmp=$(mktemp -d)",
      "cat > \"$tmp/recipe.json\" <<'JSON'",
      JSON.stringify(
        {
          id: RECIPE_ID,
          name: "llama.cpp RPC Split (AMD worker + NVIDIA host)",
          backend: "llamacpp",
          model_path: modelPath.trim(),
          max_model_len: 8192,
          host: "0.0.0.0",
          port: 8000,
          served_model_name: SERVED_MODEL_NAME,
          extra_args: {
            // RPC worker(s)
            rpc: rpcTarget,
            // Split settings (pipeline-ish sharding)
            "split-mode": "layer",
            "tensor-split": TENSOR_SPLIT,
            // Try to keep all layers on accelerators (local+remote).
            "gpu-layers": "all",
          },
        },
        null,
        2,
      ),
      "JSON",
      // Upsert recipe.
      `curl -fsS -X POST \"$controller_url/recipes\" -H 'content-type: application/json' --data-binary @\"$tmp/recipe.json\" >/dev/null || true`,
      `curl -fsS -X PUT \"$controller_url/recipes/${RECIPE_ID}\" -H 'content-type: application/json' --data-binary @\"$tmp/recipe.json\" >/dev/null || true`,
      // Start service.
      `curl -fsS -X POST \"$controller_url/services/llm/start?replace=1\" -H 'content-type: application/json' -d '{\"recipe_id\":\"${RECIPE_ID}\"}' | jq '.service | {id,status,runtime,port,pid,last_error}'`,
      "echo",
      // Quick smoke via controller proxy.
      `curl -fsS -X POST \"$controller_url/v1/chat/completions\" -H 'content-type: application/json' -d '{\"model\":\"${SERVED_MODEL_NAME}\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: ok\"}],\"max_tokens\":8,\"temperature\":0}' | jq -r '.choices[0].message.content'`,
      "echo",
    ].join("\n"),
  ]);

  console.log(`[rpc] done. NVIDIA llama-server should now be using AMD rpc-server at ${rpcTarget}`);
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
