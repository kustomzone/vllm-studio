<!-- CRITICAL -->
# Model Recommendations (Single High-VRAM GPU, ROCm-Friendly)

This doc is a pragmatic starting point for a single high-VRAM GPU host (e.g. MI300X). It is focused on operators who want stable bring-up, clear tradeoffs, and predictable VRAM pressure.

If you are doing “day 0” bring-up, start with **one small/medium LLM**, then add VLM and modalities once the basics are stable. See `docs/rocm-mi300x-playbook.md`.

## Principles

- Prefer one strong “main LLM” and keep it loaded; treat everything else as on-demand services.
- Prefer integrations that work on both NVIDIA and AMD:
  - Cross-vendor compute backends (Vulkan) where viable.
  - ROCm/CUDA-specific backends when Vulkan is not available.
- Avoid uncontrolled downloads:
  - Keep a disk budget and pin model versions.
- Keep VRAM contention explicit:
  - Use GPU lease semantics for services that cannot coexist.

## Disk Budget (Do This First)

Even if your VM has a large disk, don’t let model downloads sprawl. Rough guidance:

- 7B to 9B class models: often tens of GB (depending on format/quantization).
- 30B to 40B class models: often tens to 100+ GB.
- 70B+ class models: can be 100+ GB and quickly dominate disk usage.

Recommendations:
- Create a dedicated subdirectory per modality under `VLLM_STUDIO_MODELS_DIR` and delete anything you are not actively using.
- Prefer a single “blessed” model per category until you have stable monitoring + reproducible recipes.

## LLM / VLM

**Recommended**
- Start with a single instruction-tuned LLM that is easy to serve and iterate on.
  - “Bring-up sizes”: 7B to 9B, then scale to 32B to 72B once telemetry and recipes are stable.
  - Use vLLM (or SGLang) on ROCm when supported.
- Add a VLM (image+text) model only after plain text chat is stable.
  - Enable `VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1` (controller) and `NEXT_PUBLIC_VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1` (frontend).
  - In agent mode, vLLM Studio will send true image parts through `/chats/:id/turn` when enabled.

**Suggested shortlists (examples by family, not guarantees)**
- LLM (reliable bring-up targets):
  - Llama-class 8B Instruct
  - Qwen-class 7B Instruct
- LLM (bigger, higher quality on a high-VRAM GPU):
  - Llama-class 70B Instruct
  - Qwen-class 72B Instruct
- VLM (image+text chat):
  - Llama-class Vision Instruct (11B class)
  - Qwen-class VL Instruct (7B class)

**Why this works**
- vLLM Studio can pass real multimodal image content through both:
  - the direct OpenAI path (`/v1/chat/completions`) when enabled
  - the agent runtime path (`/chats/:id/turn`) so tools remain available

**Experimental**
- Multi-model concurrency (multiple LLM runtimes active at once). This is intentionally gated behind strict GPU lease + explicit replace/best-effort flows.
- “Serve everything at once” (LLM + image + video simultaneously). Treat non-LLM modalities as on-demand services.

## STT (Speech-to-Text)

**Recommended**
- `whisper.cpp` CLI with a Vulkan backend where available.
- Use a small-to-medium Whisper model for day-0 reliability; upgrade to a larger model only if needed.

**Why**
- Cross-vendor GPU story via Vulkan (NVIDIA + AMD), and a clean CLI contract that the controller can broker.

**Tradeoffs**
- Vulkan acceleration quality/perf depends on the build and drivers.
- CPU fallback is reliable but may be slower.

## TTS (Text-to-Speech)

**Recommended**
- `piper` (ONNX) as a baseline.
- Start with one English voice (or your target locale) and keep the voice set small.

**Why**
- Fast bring-up, clear “model file in / models out” story, and easy local-only operation.

**Tradeoffs**
- GPU acceleration depends on how the ONNX runtime is packaged (CUDA/ROCm provider availability varies).
- CPU TTS may be acceptable for many workflows; treat GPU TTS as optional.

## Image Generation

**Recommended**
- `stable-diffusion.cpp` CLI (Vulkan backend where available).
- Start with a known baseline (e.g. SD 1.5 or SDXL class) and validate deterministically.

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

**Experimental**
- Treat video generation as a separate “one-at-a-time” GPU lease service.
- Prefer workflows that can be run deterministically (fixed seed, fixed steps) so failures are diagnosable.

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
