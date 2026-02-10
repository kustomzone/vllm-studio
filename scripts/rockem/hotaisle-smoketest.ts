#!/usr/bin/env bun
// CRITICAL
/**
 * HotAisle MI300X smoke test (real STT/TTS/image + real LLM backend).
 *
 * Usage:
 *   bun vllm-studio/scripts/rockem/hotaisle-smoketest.ts
 *
 * Optional env:
 *   ROCKEM_SSH_TARGET=hotaisle@23.183.40.67
 */

const SSH_TARGET = process.env["ROCKEM_SSH_TARGET"] ?? "hotaisle@23.183.40.67";

const sshBash = async (script: string): Promise<void> => {
  const proc = Bun.spawn(
    [
      "ssh",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=20",
      "-o",
      "ServerAliveCountMax=3",
      SSH_TARGET,
      "bash",
      "-s",
    ],
    { stdin: new Blob([script]), stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Remote script failed (${code})`);
};

const main = async (): Promise<void> => {
  await sshBash(String.raw`set -euo pipefail

echo "[smoketest] health"
curl -sS http://127.0.0.1:8080/health | jq '.'

echo "[smoketest] platform"
curl -sS http://127.0.0.1:8080/config | jq '.runtime.platform'

echo "[smoketest] models"
curl -sS http://127.0.0.1:8080/v1/models | jq '.data | map({id,active,max_model_len})'

echo "[smoketest] recipes"
curl -sS http://127.0.0.1:8080/recipes | jq 'map({id,name,status,backend})'

echo "[smoketest] start llm"
RECIPE_ID="$(curl -sS http://127.0.0.1:8080/recipes | jq -r '.[0].id // empty')"
if [[ -z "$RECIPE_ID" ]]; then
  echo "No recipes returned from /recipes" >&2
  exit 2
fi
curl -sS -X POST 'http://127.0.0.1:8080/services/llm/start?replace=1' -H 'content-type: application/json' \
  -d "$(jq -nc --arg r "$RECIPE_ID" '{recipe_id:$r}')" \
  | jq '.service | {id,status,pid,port,runtime,last_error}'

echo "[smoketest] chat"
MODEL_ID="$(curl -sS http://127.0.0.1:8080/v1/models | jq -r '.data[0].id // empty')"
if [[ -z "$MODEL_ID" ]]; then
  echo "No models returned from /v1/models" >&2
  exit 2
fi
curl -sS -X POST http://127.0.0.1:8080/v1/chat/completions -H 'content-type: application/json' \
  -d "$(jq -nc --arg m "$MODEL_ID" '{"model":$m,"messages":[{"role":"system","content":"Only output the final answer."},{"role":"user","content":"Reply with exactly: ok"}],"max_tokens":32,"temperature":0}')" \
  | jq -r '.choices[0].message.content // .choices[0].message.reasoning_content // ""'

echo "[smoketest] tts -> file"
curl -sS -X POST http://127.0.0.1:8080/v1/audio/speech -H 'content-type: application/json' \
  -d '{"input":"hello from rock em on mi300x","model":"en_US-amy-medium.onnx"}' \
  --output /tmp/rockem-tts.wav
file /tmp/rockem-tts.wav | head -1

echo "[smoketest] stt -> text"
curl -sS -X POST http://127.0.0.1:8080/v1/audio/transcriptions \
  -F model=ggml-large-v3.bin -F file=@/tmp/rockem-tts.wav | jq '.'

echo "[smoketest] image (strict should conflict while llm holds lease)"
curl -sS -X POST http://127.0.0.1:8080/v1/images/generations -H 'content-type: application/json' \
  -d '{"prompt":"a red apple on a wooden table","model":"v1-5-pruned-emaonly.safetensors","width":512,"height":512,"steps":5}' \
  | jq '{code,detail}'

echo "[smoketest] image (replace=true will stop llm and run)"
curl -sS -X POST http://127.0.0.1:8080/v1/images/generations -H 'content-type: application/json' \
  -d '{"prompt":"a red apple on a wooden table","model":"v1-5-pruned-emaonly.safetensors","width":512,"height":512,"steps":5,"replace":true}' \
  | jq '{created:.created, bytes:(.data[0].b64_json|length)}'

echo "[smoketest] restart llm (replace image lease holder)"
curl -sS -X POST 'http://127.0.0.1:8080/services/llm/start?replace=1' -H 'content-type: application/json' \
  -d "$(jq -nc --arg r "$RECIPE_ID" '{recipe_id:$r}')" \
  | jq '.service | {id,status,pid,port,runtime,last_error}'

echo "[smoketest] done"
`);
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
