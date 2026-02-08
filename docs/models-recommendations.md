<!-- CRITICAL -->
# Model Recommendations (Single High-VRAM GPU, ROCm-Friendly)

This doc is a pragmatic starting point for a single high-VRAM GPU host (e.g. MI300X). It is focused on operators who want stable bring-up, clear tradeoffs, and predictable VRAM pressure.

## Principles

- Prefer one strong “main LLM” and keep it loaded; treat everything else as on-demand services.
- Prefer integrations that work on both NVIDIA and AMD:
  - Cross-vendor compute backends (Vulkan) where viable.
  - ROCm/CUDA-specific backends when Vulkan is not available.
- Avoid uncontrolled downloads:
  - Keep a disk budget and pin model versions.
- Keep VRAM contention explicit:
  - Use GPU lease semantics for services that cannot coexist.

## LLM / VLM

**Recommended**
- A strong instruction-tuned LLM sized to your latency/quality target (single-GPU friendly).
  - Use vLLM (or SGLang) on ROCm when supported.
- For VLM (image+text):
  - Use an OpenAI-compatible backend that accepts `image_url` parts and a model with vision support.
  - Enable `VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1` (controller) and `NEXT_PUBLIC_VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1` (frontend).

**Why this works**
- vLLM Studio can pass real multimodal image content through both:
  - the direct OpenAI path (`/v1/chat/completions`) when enabled
  - the agent runtime path (`/chats/:id/turn`) so tools remain available

**Experimental**
- Multi-model concurrency (multiple LLM runtimes active at once). This is intentionally gated behind strict GPU lease + explicit replace/best-effort flows.

## STT (Speech-to-Text)

**Recommended**
- `whisper.cpp` CLI with a Vulkan backend where available.

**Why**
- Cross-vendor GPU story via Vulkan (NVIDIA + AMD), and a clean CLI contract that the controller can broker.

**Tradeoffs**
- Vulkan acceleration quality/perf depends on the build and drivers.
- CPU fallback is reliable but may be slower.

## TTS (Text-to-Speech)

**Recommended**
- `piper` (ONNX) as a baseline.

**Why**
- Fast bring-up, clear “model file in / models out” story, and easy local-only operation.

**Tradeoffs**
- GPU acceleration depends on how the ONNX runtime is packaged (CUDA/ROCm provider availability varies).
- CPU TTS may be acceptable for many workflows; treat GPU TTS as optional.

## Image Generation

**Recommended**
- `stable-diffusion.cpp` CLI (Vulkan backend where available).

**Why**
- CLI-oriented interface that is easy to broker from the controller.
- Potential cross-vendor GPU path via Vulkan.

**Tradeoffs**
- Model compatibility varies by build; start with a known-working baseline model and validate deterministically.

## Video Generation

**Recommended**
- Defer on day 0.

**Why**
- Video models are large, VRAM-hungry, and tend to destabilize early bring-up.
- Build confidence with LLM/VLM + STT/TTS + images first, then introduce video behind strict GPU lease.

## Orchestration Models

**Recommended**
- Use your main LLM as the orchestrator; keep tool interfaces stable and deterministic.

**Why**
- Avoids spinning up additional tool-router LLMs and unnecessary VRAM pressure.

## Directory Layout (Local-Only)

Suggested structure under `VLLM_STUDIO_MODELS_DIR`:

```
/models/
  llm/
  vlm/
  stt/
  tts/
  image/
  video/
```

Suggested structure under the controller artifacts directory (see controller config):

```
artifacts/
  image/
  audio/
  video/
```

## Operational Notes

- If GPU telemetry is missing on ROCm, set:
  - `VLLM_STUDIO_GPU_SMI_TOOL=amd-smi` (or `rocm-smi`)
- For explicit ROCm device selection in recipes:
  - use `visible_devices` in recipes (maps to `HIP_VISIBLE_DEVICES` + `ROCR_VISIBLE_DEVICES` on ROCm)

