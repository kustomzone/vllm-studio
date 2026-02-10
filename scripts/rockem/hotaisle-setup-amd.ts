#!/usr/bin/env bun
// CRITICAL
/**
 * HotAisle MI300X ROCm bring-up for vLLM Studio (amd branch).
 *
 * Provisions "real binaries + real models" on the remote VM and starts the controller.
 * Does not open public ports; use SSH port-forwarding for access.
 *
 * Usage:
 *   ROCKEM_SSH_TARGET=hotaisle@23.183.40.84 bun vllm-studio/scripts/rockem/hotaisle-setup-amd.ts
 *
 * Optional env:
 *   ROCKEM_REPO_DIR=~/vllm-studio-amd
 *   ROCKEM_MODELS_DIR=/models
 */

const SSH_TARGET = process.env["ROCKEM_SSH_TARGET"] ?? "hotaisle@23.183.40.84";
const normalizeRemotePath = (input: string): string => {
  const trimmed = input.trim();
  // Remote bash won't expand ~ after parameter expansion; prefer $HOME.
  if (trimmed.startsWith("~/")) return `$HOME/${trimmed.slice(2)}`;
  if (trimmed === "~") return "$HOME";
  return trimmed;
};
const REPO_DIR = normalizeRemotePath(process.env["ROCKEM_REPO_DIR"] ?? "$HOME/vllm-studio-amd");
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
  await sshBash(String.raw`set -euo pipefail

echo "[amd-setup] target: $(hostname)"
echo "[amd-setup] ensure deps"
sudo -n apt-get update -y
sudo -n apt-get install -y --no-install-recommends \
  build-essential cmake ninja-build pkg-config curl unzip tar jq ffmpeg git ca-certificates \
  python3 python3-venv python3-pip

echo "[amd-setup] ensure /models layout"
sudo -n mkdir -p ${MODELS_DIR}/stt ${MODELS_DIR}/tts ${MODELS_DIR}/image ${MODELS_DIR}/llm ${MODELS_DIR}/video ${MODELS_DIR}/music ${MODELS_DIR}/image-edit
sudo -n chown -R "$USER":"$USER" ${MODELS_DIR}

echo "[amd-setup] ensure bun"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi

echo "[amd-setup] ensure repo (${REPO_DIR})"
if [ ! -d ${REPO_DIR} ]; then
  git clone https://github.com/0xSero/vllm-studio.git ${REPO_DIR}
fi
cd ${REPO_DIR}
git fetch origin
git checkout -B amd origin/amd
git pull --ff-only || true

echo "[amd-setup] controller deps + tests"
cd controller
~/.bun/bin/bun install
~/.bun/bin/bun run typecheck
~/.bun/bin/bun test
cd ..

echo "[amd-setup] build whisper.cpp (HIP)"
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

echo "[amd-setup] install piper (CPU; cross-vendor baseline)"
sudo -n apt-get install -y --no-install-recommends libespeak-ng1
if [ ! -d /opt/piper ]; then
  tmpdir="$(mktemp -d)"
  curl -fsSL -o "$tmpdir/piper.tar.gz" \
    https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
  sudo -n mkdir -p /opt/piper
  sudo -n tar -xzf "$tmpdir/piper.tar.gz" -C /opt/piper --strip-components=1
  rm -rf "$tmpdir"
fi
if [ ! -x /usr/local/bin/piper ]; then
  sudo -n tee /usr/local/bin/piper >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="/opt/piper:\${LD_LIBRARY_PATH:-}"
exec /opt/piper/piper "$@"
EOF
  sudo -n chmod +x /usr/local/bin/piper
fi

echo "[amd-setup] build stable-diffusion.cpp (HIP)"
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

echo "[amd-setup] build llama.cpp (HIP)"
if [ ! -d ~/src/llama.cpp ]; then
  git clone https://github.com/ggml-org/llama.cpp.git ~/src/llama.cpp
fi
cd ~/src/llama.cpp
git fetch origin
git pull --ff-only || true
cmake -S . -B build -DGGML_HIP=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build -j "$(nproc)"
test -x build/bin/llama-server
test -x build/bin/rpc-server

echo "[amd-setup] download baseline models"
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

echo "[amd-setup] download GLM-4.7-Flash (Q8_0 GGUF)"
if [ ! -f ${MODELS_DIR}/llm/GLM-4.7-Flash-Q8_0.gguf ]; then
  curl -L --retry 3 --retry-delay 2 -o ${MODELS_DIR}/llm/GLM-4.7-Flash-Q8_0.gguf \
    https://huggingface.co/unsloth/GLM-4.7-Flash-GGUF/resolve/main/GLM-4.7-Flash-Q8_0.gguf
fi

echo "[amd-setup] write controller .env"
cat > ${REPO_DIR}/controller/.env <<EOF
VLLM_STUDIO_HOST=0.0.0.0
VLLM_STUDIO_PORT=8080
VLLM_STUDIO_INFERENCE_PORT=8000
VLLM_STUDIO_MODELS_DIR=${MODELS_DIR}
VLLM_STUDIO_GPU_SMI_TOOL=amd-smi
VLLM_STUDIO_STT_CLI=/home/$USER/src/whisper.cpp/build/bin/whisper-cli
VLLM_STUDIO_STT_MODEL=ggml-large-v3.bin
VLLM_STUDIO_TTS_CLI=/usr/local/bin/piper
VLLM_STUDIO_TTS_MODEL=en_US-amy-medium.onnx
VLLM_STUDIO_IMAGE_CLI=/home/$USER/src/stable-diffusion.cpp/build/bin/sd-cli
VLLM_STUDIO_IMAGE_MODEL=v1-5-pruned-emaonly.safetensors
VLLM_STUDIO_LLAMA_BIN=/home/$USER/src/llama.cpp/build/bin/llama-server
EOF

echo "[amd-setup] restart controller on :8080"
controller_pid="$(ss -lptn 2>/dev/null | sed -n '/:8080/ s/.*pid=\\([0-9][0-9]*\\).*/\\1/p' | head -1 || true)"
if [ -n "$controller_pid" ]; then
  kill "$controller_pid" || true
  sleep 1
fi
cd ${REPO_DIR}/controller
nohup ~/.bun/bin/bun src/main.ts > ~/vllm-studio-amd-controller.log 2>&1 & echo $! > ~/vllm-studio-amd-controller.pid
sleep 1
curl -sS http://127.0.0.1:8080/health
echo

echo "[amd-setup] create GLM llama.cpp recipe (idempotent)"
cat > /tmp/glm-recipe.json <<'JSON'
{
  "id": "glm-4.7-flash-q8_0-llamacpp-rocm",
  "name": "GLM-4.7-Flash (Q8_0) [llama.cpp ROCm]",
  "backend": "llamacpp",
  "model_path": "/models/llm/GLM-4.7-Flash-Q8_0.gguf",
  "max_model_len": 32768,
  "host": "0.0.0.0",
  "port": 8000,
  "served_model_name": "glm-4.7-flash",
  "extra_args": {
    "n_gpu_layers": "all",
    "temp": 1.0,
    "top-p": 0.95,
    "repeat-penalty": 1.0
  }
}
JSON
curl -sS -X POST http://127.0.0.1:8080/recipes -H 'content-type: application/json' --data-binary @/tmp/glm-recipe.json >/dev/null || true

echo "[amd-setup] start LLM service (GLM)"
curl -sS -X POST 'http://127.0.0.1:8080/services/llm/start?replace=1' -H 'content-type: application/json' -d '{"recipe_id":"glm-4.7-flash-q8_0-llamacpp-rocm"}' | jq '.service | {id,status,runtime,port,pid,last_error}'

echo "[amd-setup] quick smoke (direct llama.cpp OpenAI endpoint)"
curl -sS -X POST http://127.0.0.1:8000/v1/chat/completions -H 'content-type: application/json' \
  -d '{"model":"glm-4.7-flash","messages":[{"role":"user","content":"Reply with exactly: ok"}],"max_tokens":8,"temperature":0}' \
  | jq -r '.choices[0].message.content'
echo

echo "[amd-setup] done"
echo "Next: ssh -N -L 18080:127.0.0.1:8080 ${SSH_TARGET}"
`);
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
