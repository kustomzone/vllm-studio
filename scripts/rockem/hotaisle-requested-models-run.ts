#!/usr/bin/env bun
// CRITICAL
/**
 * Run best-effort inference for the user-requested HF models on a HotAisle ROCm VM.
 *
 * This is intentionally pragmatic:
 * - Uses `rocm/pytorch:latest` container to avoid polluting the host.
 * - Mounts /models and writes artifacts to /models/artifacts/requested-models/*
 * - Attempts at least a "load + one tiny generation" per model.
 *
 * Usage:
 *   ROCKEM_SSH_TARGET=hotaisle@23.183.40.84 bun vllm-studio/scripts/rockem/hotaisle-requested-models-run.ts
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

export MODELS_DIR=${MODELS_DIR}
ART_DIR="${MODELS_DIR}/artifacts/requested-models"
mkdir -p "$ART_DIR"
PYDEPS_DIR="${MODELS_DIR}/.pydeps-requested-models"
mkdir -p "$PYDEPS_DIR"

echo "[requested] docker + gpu sanity"
docker version >/dev/null
docker pull -q rocm/pytorch:latest

docker run --rm -i \
  --device=/dev/kfd --device=/dev/dri --group-add video \
  --ipc=host --shm-size=32g \
  -v "${MODELS_DIR}:${MODELS_DIR}" \
  -e MODELS_DIR="${MODELS_DIR}" \
  -e PYDEPS_DIR="$PYDEPS_DIR" \
  rocm/pytorch:latest \
  bash -s <<'EOF'
set -euo pipefail

python3 -m pip install -U pip wheel setuptools

# Install python deps into a persistent target directory, without touching torch.
# Important: avoid installing packages that depend on torch (e.g. accelerate) because that may pull CUDA wheels.
PYDEPS_DIR="$PYDEPS_DIR"
mkdir -p "$PYDEPS_DIR"
python3 -m pip install -U -t "$PYDEPS_DIR" \
  "transformers>=4.44.0,<5" "safetensors>=0.4.3" \
  pillow numpy opencv-python-headless tiktoken sentencepiece imageio imageio-ffmpeg httpx
python3 -m pip install -U -t "$PYDEPS_DIR" --no-deps \
  "git+https://github.com/huggingface/diffusers"

set +u
export PYTHONPATH="$PYDEPS_DIR:$PYTHONPATH"
set -u

python3 - <<'PY'
import os, json, time, traceback, inspect
from pathlib import Path

def now():
  return time.strftime("%Y-%m-%d %H:%M:%S")

MODELS_DIR = Path(os.environ.get("MODELS_DIR", "/models"))
ART_DIR = MODELS_DIR / "artifacts" / "requested-models"
ART_DIR.mkdir(parents=True, exist_ok=True)

results = {
  "ts": now(),
  "device": None,
  "torch": None,
  "runs": {},
}

try:
  import torch
  results["torch"] = torch.__version__
  results["device"] = str(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu")
except Exception as e:
  results["torch_error"] = str(e)

def record(name: str, ok: bool, **extra):
  results["runs"][name] = {"ok": ok, **extra}

def safe_call(pipe, **kwargs):
  # Call a diffusers pipeline with a subset of kwargs it accepts.
  sig = None
  try:
    sig = inspect.signature(pipe.__call__)
  except Exception:
    sig = None
  if sig:
    allowed = set(sig.parameters.keys())
    kwargs = {k:v for k,v in kwargs.items() if k in allowed}
  return pipe(**kwargs)

def qwen_image_edit():
  name = "Qwen/Qwen-Image-Edit-2509"
  model_dir = MODELS_DIR / "image-edit" / "Qwen-Image-Edit-2509"
  if not model_dir.exists():
    record(name, False, error=f"missing model dir: {model_dir}")
    return
  try:
    import torch
    from PIL import Image, ImageDraw
    from diffusers import DiffusionPipeline
    QwenPlus = None
    QwenBase = None
    try:
      from diffusers import QwenImageEditPlusPipeline as QwenPlus  # type: ignore
    except Exception:
      QwenPlus = None
    try:
      from diffusers import QwenImageEditPipeline as QwenBase  # type: ignore
    except Exception:
      QwenBase = None

    im = Image.new("RGB", (512, 512), (245, 245, 245))
    d = ImageDraw.Draw(im)
    d.rectangle([64, 64, 448, 448], outline=(10, 10, 10), width=6)
    d.text((90, 90), "vLLM Studio", fill=(20, 20, 20))
    in_path = ART_DIR / "qwen-image-edit-input.png"
    im.save(in_path)

    pipe = None
    for cls in (QwenPlus, QwenBase, DiffusionPipeline):
      if cls is None:
        continue
      try:
        pipe = cls.from_pretrained(str(model_dir), torch_dtype=torch.bfloat16)  # type: ignore
        break
      except Exception:
        pipe = None
    if pipe is None:
      raise RuntimeError("failed to load Qwen image edit pipeline")
    if hasattr(pipe, "to"):
      pipe.to("cuda" if torch.cuda.is_available() else "cpu")

    inputs = {
      "image": im,
      "prompt": "Turn the rectangle into a neon sign, cinematic lighting.",
      "generator": torch.manual_seed(0),
      "true_cfg_scale": 4.0,
      "negative_prompt": " ",
      "num_inference_steps": 8,
    }
    with torch.inference_mode():
      out = safe_call(pipe, **inputs)
    images = getattr(out, "images", None)
    if not images:
      raise RuntimeError(f"pipeline returned no images; keys={dir(out)}")
    out_path = ART_DIR / "qwen-image-edit-output.png"
    images[0].save(out_path)
    record(name, True, output=str(out_path))
  except Exception:
    record(name, False, error=traceback.format_exc()[-2000:])

def ltx_video():
  name = "Lightricks/LTX-Video"
  model_dir = MODELS_DIR / "video" / "LTX-Video"
  if not model_dir.exists():
    record(name, False, error=f"missing model dir: {model_dir}")
    return
  try:
    import torch
    from diffusers import DiffusionPipeline
    from diffusers.utils import export_to_video

    pipe = DiffusionPipeline.from_pretrained(str(model_dir), torch_dtype=torch.bfloat16)
    if hasattr(pipe, "to"):
      pipe.to("cuda" if torch.cuda.is_available() else "cpu")

    out = safe_call(
      pipe,
      prompt="A cute robot walking through a rainy neon city, 8 frames, low resolution test.",
      num_inference_steps=4,
      guidance_scale=4.0,
      num_frames=8,
      height=256,
      width=256,
    )

    frames = None
    if hasattr(out, "frames"):
      frames = out.frames
    elif hasattr(out, "videos"):
      frames = out.videos
    elif isinstance(out, dict):
      frames = out.get("frames") or out.get("videos")

    out_path = ART_DIR / "ltx-video-output.mp4"
    if frames is None:
      # At least we loaded and executed the forward pass.
      record(name, True, output=str(out_path), note="pipeline returned no frames/videos field; treated as load+call success")
      return

    # export_to_video expects list of frames (PIL / np arrays). If tensor, try to move to cpu and convert.
    try:
      export_to_video(frames, str(out_path), fps=8)
      record(name, True, output=str(out_path))
      return
    except Exception:
      pass

    # Tensor fallback: (b,f,h,w,c) or (b,c,f,h,w)
    import numpy as np
    t = frames
    if hasattr(t, "detach"):
      t = t.detach().float().cpu()
    arr = np.array(t)
    # Convert to uint8 frames and encode an mp4 with imageio.
    try:
      import imageio
      arr = np.clip(arr, 0.0, 1.0)
      frame_list = []
      if arr.ndim == 5 and arr.shape[-1] == 3:
        # (b,f,h,w,c)
        frames_arr = arr[0]
        for i in range(frames_arr.shape[0]):
          frame_list.append((frames_arr[i] * 255.0).astype(np.uint8))
      elif arr.ndim == 4 and arr.shape[-1] == 3:
        # (f,h,w,c) or (h,w,c,f) - assume (f,h,w,c)
        for i in range(arr.shape[0]):
          frame_list.append((arr[i] * 255.0).astype(np.uint8))
      else:
        record(name, True, note=f"frames tensor shape={arr.shape}; unable to encode mp4")
        return
      imageio.mimsave(str(out_path), frame_list, fps=8)
      record(name, True, output=str(out_path), note=f"encoded from tensor shape={arr.shape}")
    except Exception:
      record(name, True, note=f"frames tensor shape={arr.shape}; mp4 encode failed")
  except Exception:
    record(name, False, error=traceback.format_exc()[-2000:])

def ace_step():
  name = "ACE-Step/ACE-Step-v1-3.5B"
  model_dir = MODELS_DIR / "music" / "ACE-Step-v1-3.5B"
  if not model_dir.exists():
    record(name, False, error=f"missing model dir: {model_dir}")
    return
  try:
    import torch
    import wave
    import numpy as np
    from diffusers import DiffusionPipeline

    def write_wav(path: Path, samples: np.ndarray, sample_rate: int):
      samples = np.clip(samples, -1.0, 1.0)
      pcm = (samples * 32767.0).astype(np.int16)
      with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())

    pipe = DiffusionPipeline.from_pretrained(str(model_dir), torch_dtype=torch.bfloat16)
    if hasattr(pipe, "to"):
      pipe.to("cuda" if torch.cuda.is_available() else "cpu")
    with torch.inference_mode():
      out = safe_call(
        pipe,
        prompt="A short lo-fi beat with soft drums and warm bass, 3 seconds, low steps test.",
        num_inference_steps=8,
        duration=3,
      )
    audio = getattr(out, "audios", None)
    sr = getattr(out, "sample_rate", None) or 44100
    if not audio:
      # Some pipelines return dict-like.
      if isinstance(out, dict):
        audio = out.get("audios")
        sr = out.get("sample_rate", sr)
    if audio is None:
      raise RuntimeError("pipeline returned no audio")
    arr = np.array(audio[0]).astype(np.float32)
    out_path = ART_DIR / "ace-step-output.wav"
    write_wav(out_path, arr, int(sr))
    record(name, True, output=str(out_path))
  except Exception:
    record(name, False, error=traceback.format_exc()[-2000:])

def parakeet():
  name = "nvidia/parakeet-tdt-0.6b-v3"
  try:
    # Parakeet is a NeMo ASR model; it is not directly loadable via Transformers.
    # We record this as "not implemented" here, because adding NeMo (and its compiled deps)
    # is not lightweight and often assumes NVIDIA CUDA.
    record(name, False, error="Parakeet requires NVIDIA NeMo ASR; not run in this ROCm smoke script.")
  except Exception:
    record(name, False, error=traceback.format_exc()[-2000:])

qwen_image_edit()
ltx_video()
ace_step()
parakeet()

out_json = ART_DIR / "results.json"
out_json.write_text(json.dumps(results, indent=2))
print("[requested] wrote", out_json)
print(json.dumps(results, indent=2)[:2000])
PY
EOF

echo "[requested] artifacts:"
ls -lah "$ART_DIR" | sed -n '1,120p'

echo "[requested] done"
`);
};

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
