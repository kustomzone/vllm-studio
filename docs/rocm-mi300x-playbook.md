<!-- CRITICAL -->
# ROCm MI300X Playbook (Day 0)

This is a practical bring-up checklist for an AMD Instinct MI300X host running ROCm, using the vLLM Studio controller and UI.

## 0. Host Sanity (ROCm + GPU Visibility)

```bash
rocminfo | head
amd-smi version
amd-smi static -g 0
amd-smi metric -g 0
```

Expected:
- `rocminfo` shows at least one `gfx*` target (e.g. `gfx942` on MI300X).
- `amd-smi version` reports a ROCm version.

If `amd-smi` is missing, try:

```bash
rocm-smi --showproductname
rocm-smi --showdriverversion
```

## 1. Python + Torch (ROCm Build Check)

If you use Python for runtime components (vLLM/SGLang), verify Torch is a ROCm build:

```bash
python3 - <<'PY'
import torch
print("torch", torch.__version__)
print("cuda", getattr(torch.version, "cuda", None))
print("hip", getattr(torch.version, "hip", None))
print("is_cuda_available", torch.cuda.is_available())
PY
```

Expected:
- `torch.version.hip` is non-null on ROCm.

## 2. vLLM (ROCm) Quick Smoke Test

Install vLLM following upstream ROCm instructions for your environment.

Once installed, do a minimal health check:

```bash
vllm --version
vllm serve --help | head
```

To start a server (example):

```bash
export VLLM_HOST=0.0.0.0
export VLLM_PORT=8000

# Example only: choose a model path that exists on disk.
vllm serve /models/your-model --served-model-name your-model --port "$VLLM_PORT"
```

Then:

```bash
curl -sS http://127.0.0.1:8000/health
curl -sS http://127.0.0.1:8000/v1/models | head
```

## 3. vLLM Studio Controller (Bun) Bring-Up

Environment variables (core):

```bash
export VLLM_STUDIO_PORT=8080
export VLLM_STUDIO_INFERENCE_PORT=8000
export VLLM_STUDIO_MODELS_DIR=/models
```

ROCm telemetry selection (recommended on AMD):

```bash
export VLLM_STUDIO_GPU_SMI_TOOL=amd-smi
```

VLM attachments (multimodal images through OpenAI-style `image_url` parts):

```bash
export VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1
```

Start the controller:

```bash
cd controller
bun install
bun run src/main.ts
```

Verify:

```bash
curl -sS http://127.0.0.1:8080/health
curl -sS http://127.0.0.1:8080/gpus | head
curl -sS http://127.0.0.1:8080/config | head
curl -sS http://127.0.0.1:8080/compat | head
curl -sS http://127.0.0.1:8080/services | head
```

Expected:
- `/config` reports `runtime.platform.kind=rocm` and ROCm/HIP/Torch build fields.
- `/gpus` is non-empty on ROCm hosts (via `amd-smi` or `rocm-smi`).
- `/compat` explains common “why doesn’t it work” failures in one response.

## 4. UI Bring-Up (Port Forward)

Keep the controller bound locally on the VM and use SSH port forwarding:

```bash
ssh -N -L 18080:127.0.0.1:8080 <user>@<vm-ip>
```

Then in your local browser:
- `http://127.0.0.1:18080`

## 5. First ROCm Validation Checklist (UI)

1. Dashboard shows `platform: rocm`.
2. GPU list is populated with VRAM/util/temp/power (when available).
3. Config page shows:
   - ROCm version, HIP version, torch ROCm build fields
   - Compatibility panel warnings (actionable)
4. Runtimes (Rock-Em) panel shows services and the current GPU lease holder.

