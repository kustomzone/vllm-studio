#!/usr/bin/env bun
// CRITICAL
/**
 * HotAisle MI300X ROCm bring-up for vLLM Studio (Rock-Em support).
 *
 * This script provisions "real binaries + real models" on the remote VM and starts the controller.
 * It does not require opening any public ports; use SSH port-forwarding for access.
 *
 * Usage:
 *   bun vllm-studio/scripts/rockem/hotaisle-setup.ts
 *
 * Optional env:
 *   ROCKEM_SSH_TARGET=hotaisle@23.183.40.67
 *   ROCKEM_REPO_DIR=~/vllm-studio-rockem
 *   ROCKEM_MODELS_DIR=/models
 */

const SSH_TARGET = process.env["ROCKEM_SSH_TARGET"] ?? "hotaisle@23.183.40.67";
const normalizeRemotePath = (input: string): string => {
  const trimmed = input.trim();
  // Remote bash won't expand ~ after parameter expansion; prefer $HOME.
  if (trimmed.startsWith("~/")) return `$HOME/${trimmed.slice(2)}`;
  if (trimmed === "~") return "$HOME";
  return trimmed;
};
const REPO_DIR = normalizeRemotePath(process.env["ROCKEM_REPO_DIR"] ?? "$HOME/vllm-studio-rockem");
const MODELS_DIR = normalizeRemotePath(process.env["ROCKEM_MODELS_DIR"] ?? "/models");

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
  // Run everything via a single remote bash script to avoid quoting issues.
  await sshBash(String.raw`set -euo pipefail

echo "[rockem] target: $(hostname)"
echo "[rockem] ensure deps"
sudo -n apt-get update -y
sudo -n apt-get install -y --no-install-recommends \
  build-essential cmake ninja-build pkg-config curl unzip tar jq ffmpeg git ca-certificates

echo "[rockem] ensure /models layout"
sudo -n mkdir -p ${MODELS_DIR}/stt ${MODELS_DIR}/tts ${MODELS_DIR}/image ${MODELS_DIR}/llm
sudo -n chown -R "$USER":"$USER" ${MODELS_DIR}

echo "[rockem] ensure bun"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi

echo "[rockem] ensure repo (${REPO_DIR})"
if [ ! -d ${REPO_DIR} ]; then
  git clone https://github.com/0xSero/vllm-studio.git ${REPO_DIR}
fi
cd ${REPO_DIR}
git fetch origin
git checkout -B rockem-rocm-support origin/rockem-rocm-support
git pull --ff-only || true

echo "[rockem] controller deps + tests"
cd controller
~/.bun/bin/bun install
~/.bun/bin/bun run typecheck
~/.bun/bin/bun test
cd ..

echo "[rockem] build whisper.cpp (HIP)"
mkdir -p ~/src
if [ ! -d ~/src/whisper.cpp ]; then
  git clone https://github.com/ggerganov/whisper.cpp.git ~/src/whisper.cpp
fi
cd ~/src/whisper.cpp
git fetch origin
git pull --ff-only || true
cmake -S . -B build -DGGML_HIPBLAS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build -j "$(nproc)"
test -x build/bin/whisper-cli

echo "[rockem] install piper (CPU; cross-vendor baseline)"
sudo -n apt-get install -y --no-install-recommends libespeak-ng1
if [ ! -d /opt/piper ]; then
  tmpdir="$(mktemp -d)"
  curl -fsSL -o "$tmpdir/piper.tar.gz" \
    https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz
  sudo -n mkdir -p /opt/piper
  sudo -n tar -xzf "$tmpdir/piper.tar.gz" -C /opt/piper --strip-components=1
  rm -rf "$tmpdir"
fi
if [ ! -x /usr/local/bin/piper ]; then
  sudo -n tee /usr/local/bin/piper >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="/opt/piper:$LD_LIBRARY_PATH"
exec /opt/piper/piper "$@"
EOF
  sudo -n chmod +x /usr/local/bin/piper
fi

echo "[rockem] build stable-diffusion.cpp (HIP)"
if [ ! -d ~/src/stable-diffusion.cpp ]; then
  git clone https://github.com/leejet/stable-diffusion.cpp.git ~/src/stable-diffusion.cpp
fi
cd ~/src/stable-diffusion.cpp
git fetch origin
git pull --ff-only || true
git submodule update --init --recursive
cmake -S . -B build -DSD_HIPBLAS=ON -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXE_LINKER_FLAGS=-no-pie
cmake --build build -j "$(nproc)"
test -x build/bin/sd-cli

echo "[rockem] build llama.cpp (HIP)"
if [ ! -d ~/src/llama.cpp ]; then
  git clone https://github.com/ggml-org/llama.cpp.git ~/src/llama.cpp
fi
cd ~/src/llama.cpp
git fetch origin
git pull --ff-only || true
cmake -S . -B build -DGGML_HIP=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build -j "$(nproc)"
test -x build/bin/llama-server

echo "[rockem] download real models"
if [ ! -f ${MODELS_DIR}/stt/ggml-large-v3.bin ]; then
  curl -L --retry 3 --retry-delay 2 -o ${MODELS_DIR}/stt/ggml-large-v3.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
fi
if [ ! -f ${MODELS_DIR}/tts/en_US-amy-medium.onnx ]; then
  curl -L --retry 3 --retry-delay 2 -o ${MODELS_DIR}/tts/en_US-amy-medium.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
  curl -L --retry 3 --retry-delay 2 -o ${MODELS_DIR}/tts/en_US-amy-medium.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
fi
if [ ! -f ${MODELS_DIR}/image/v1-5-pruned-emaonly.safetensors ]; then
  curl -L --retry 3 --retry-delay 2 -o ${MODELS_DIR}/image/v1-5-pruned-emaonly.safetensors \
    https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors
fi
if [ ! -f ${MODELS_DIR}/llm/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf ]; then
  curl -L --retry 3 --retry-delay 2 -o ${MODELS_DIR}/llm/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
    https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf
fi

echo "[rockem] write controller .env"
cat > ${REPO_DIR}/controller/.env <<EOF
VLLM_STUDIO_PORT=8080
VLLM_STUDIO_INFERENCE_PORT=8000
VLLM_STUDIO_MODELS_DIR=${MODELS_DIR}
VLLM_STUDIO_STT_CLI=/home/$USER/src/whisper.cpp/build/bin/whisper-cli
VLLM_STUDIO_STT_MODEL=ggml-large-v3.bin
VLLM_STUDIO_TTS_CLI=/usr/local/bin/piper
VLLM_STUDIO_TTS_MODEL=en_US-amy-medium.onnx
VLLM_STUDIO_IMAGE_CLI=/home/$USER/src/stable-diffusion.cpp/build/bin/sd-cli
VLLM_STUDIO_IMAGE_MODEL=v1-5-pruned-emaonly.safetensors
VLLM_STUDIO_LLAMA_BIN=/home/$USER/src/llama.cpp/build/bin/llama-server
EOF

echo "[rockem] restart controller on :8080"
controller_pid="$(ss -lptn 2>/dev/null | sed -n '/:8080/ s/.*pid=\\([0-9][0-9]*\\).*/\\1/p' | head -1 || true)"
if [ -n "$controller_pid" ]; then
  kill "$controller_pid" || true
  sleep 1
fi
cd ${REPO_DIR}/controller
nohup ~/.bun/bin/bun src/main.ts > ~/vllm-studio-rockem-controller.log 2>&1 & echo $! > ~/vllm-studio-rockem-controller.pid
sleep 1
curl -sS http://127.0.0.1:8080/health
echo

echo "[rockem] create llama.cpp recipe (idempotent)"
cat > /tmp/llama-recipe.json <<'JSON'
{
  "id": "llama31-8b-instruct-q4km",
  "name": "Llama 3.1 8B Instruct (Q4_K_M) [llama.cpp ROCm]",
  "backend": "llamacpp",
  "model_path": "/models/llm/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
  "max_model_len": 8192,
  "host": "0.0.0.0",
  "port": 8000,
  "served_model_name": "llama31-8b",
  "extra_args": { "n_gpu_layers": "all" }
}
JSON
curl -sS -X POST http://127.0.0.1:8080/recipes -H 'content-type: application/json' --data-binary @/tmp/llama-recipe.json >/dev/null || true

echo "[rockem] start LLM service"
curl -sS -X POST http://127.0.0.1:8080/services/llm/start -H 'content-type: application/json' -d '{"recipe_id":"llama31-8b-instruct-q4km"}' | jq '.service | {id,status,runtime,port,pid,last_error}'

echo "[rockem] chat smoke test"
curl -sS -X POST http://127.0.0.1:8080/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"llama31-8b","messages":[{"role":"user","content":"Reply with exactly: ok"}],"max_tokens":16,"temperature":0}' \
  | jq -r '.choices[0].message.content'
echo

echo "[rockem] done"
echo "Next: ssh -N -L 18080:127.0.0.1:8080 ${SSH_TARGET}"
`);
};

main().catch((err) => {
  // Keep it blunt: this is an operator script.
  console.error(String(err));
  process.exit(1);
});
