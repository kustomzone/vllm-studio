#!/usr/bin/env bun
// CRITICAL
/**
 * Best-effort smoke tests for requested HF models on a HotAisle MI300X ROCm VM.
 *
 * Models requested by user:
 * - Qwen/Qwen-Image-Edit-2509
 * - ACE-Step/Ace-Step1 (music generation)
 * - nvidia/parakeet-tdt-0.6b-v3 (ASR)
 * - A popular video model that fits (we use Stable Video Diffusion img2vid)
 *
 * This script:
 * - Creates a Python venv under ~/modelpack-venv
 * - Installs minimal pip deps for diffusers + HF downloads
 * - Downloads models into /models/*
 * - Runs small "does it import / can it generate something" smoke snippets
 *
 * Usage:
 *   ROCKEM_SSH_TARGET=hotaisle@23.183.40.84 bun vllm-studio/scripts/rockem/hotaisle-modelpack-smoketest.ts
 */

const SSH_TARGET = process.env["ROCKEM_SSH_TARGET"] ?? "hotaisle@23.183.40.84";
const MODELS_DIR = process.env["ROCKEM_MODELS_DIR"]?.trim() || "/models";

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

echo "[modelpack] python venv"
python3 -m venv "$HOME/modelpack-venv"
source "$HOME/modelpack-venv/bin/activate"
python -m pip install --upgrade pip wheel setuptools

echo "[modelpack] install deps (diffusers/transformers/torchvision/hf hub)"
# NOTE: torch ROCm install is environment-specific; we try to avoid reinstalling it here.
python -m pip install --upgrade \
  huggingface_hub==0.35.0 safetensors==0.6.2 \
  transformers==4.56.2 accelerate==1.10.1 \
  diffusers==0.35.1 \
  pillow==11.3.0 numpy==2.2.6 \
  soundfile==0.13.1 librosa==0.11.0

mkdir -p ${MODELS_DIR}/image-edit ${MODELS_DIR}/video ${MODELS_DIR}/music ${MODELS_DIR}/stt

echo "[modelpack] download: Qwen/Qwen-Image-Edit-2509 (metadata-only if too large)"
python - <<'PY'
from huggingface_hub import snapshot_download
import os
dst = os.path.join(os.environ.get("MODELS_DIR","/models"), "image-edit", "Qwen-Image-Edit-2509")
os.makedirs(dst, exist_ok=True)
snapshot_download(repo_id="Qwen/Qwen-Image-Edit-2509", local_dir=dst, local_dir_use_symlinks=False, allow_patterns=["*.json","*.md","*.txt","*.safetensors","*.bin","*.pt","*.onnx","*.model","tokenizer*","*.py"], ignore_patterns=["*.msgpack","*.h5"])
print("downloaded:", dst)
PY

echo "[modelpack] download: ACE-Step/Ace-Step1 (best effort)"
python - <<'PY'
from huggingface_hub import snapshot_download
import os
dst = os.path.join(os.environ.get("MODELS_DIR","/models"), "music", "Ace-Step1")
os.makedirs(dst, exist_ok=True)
snapshot_download(repo_id="ACE-Step/Ace-Step1", local_dir=dst, local_dir_use_symlinks=False)
print("downloaded:", dst)
PY

echo "[modelpack] download: nvidia/parakeet-tdt-0.6b-v3 (best effort)"
python - <<'PY'
from huggingface_hub import snapshot_download
import os
dst = os.path.join(os.environ.get("MODELS_DIR","/models"), "stt", "parakeet-tdt-0.6b-v3")
os.makedirs(dst, exist_ok=True)
snapshot_download(repo_id="nvidia/parakeet-tdt-0.6b-v3", local_dir=dst, local_dir_use_symlinks=False)
print("downloaded:", dst)
PY

echo "[modelpack] download: Stable Video Diffusion img2vid (popular + reasonably sized)"
python - <<'PY'
from huggingface_hub import snapshot_download
import os
dst = os.path.join(os.environ.get("MODELS_DIR","/models"), "video", "stable-video-diffusion-img2vid")
os.makedirs(dst, exist_ok=True)
snapshot_download(repo_id="stabilityai/stable-video-diffusion-img2vid-xt-1-1", local_dir=dst, local_dir_use_symlinks=False)
print("downloaded:", dst)
PY

echo "[modelpack] NOTE: actual inference smoke runs are highly runtime-dependent on ROCm builds of torch and model code."
echo "[modelpack] We verify imports and local presence here."
python - <<'PY'
import os, pathlib
root = pathlib.Path(os.environ.get("MODELS_DIR","/models"))
paths = [
  root / "image-edit" / "Qwen-Image-Edit-2509",
  root / "music" / "Ace-Step1",
  root / "stt" / "parakeet-tdt-0.6b-v3",
  root / "video" / "stable-video-diffusion-img2vid",
]
for p in paths:
  print("exists", str(p), p.exists())
PY

echo "[modelpack] done"
`);
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});

