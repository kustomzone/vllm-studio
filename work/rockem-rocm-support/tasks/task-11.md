<!-- CRITICAL -->
# Task 11 — MI300X/ROCm Provisioning Playbook + Model Recommendations

## Objective
Produce a concrete “day-0” playbook for a freshly provisioned MI300X VM: what to install, what to verify first, and a staged list of recommended models and services (LLM/VLM + STT/TTS + image/video) that are realistic on ROCm.

## Files Involved
- New doc: `docs/rocm-mi300x-playbook.md`
- New doc: `docs/models-recommendations.md`
- `README.md` (link out)

## Changes
- `docs/rocm-mi300x-playbook.md`:
  - Hardware sanity:
    - confirm ROCm sees the GPU (`rocminfo`, `rocm-smi`/`amd-smi`)
  - Python + torch:
    - confirm torch is ROCm build (`torch.version.hip`)
  - vLLM:
    - install guidance for ROCm build
    - quick smoke test: start `vllm serve` and hit `/health`
  - SGLang:
    - install guidance (native or docker)
  - vLLM Studio controller:
    - run controller + docker services
    - verify `/config` shows ROCm, vLLM versions, GPU telemetry works
- `docs/models-recommendations.md`:
  - Separate “recommended” from “experimental”.
  - Pick models by constraints:
    - runs well on single high-VRAM GPU
    - known to work on ROCm (or at least via frameworks that do)
  - Provide “why” for each category:
    - STT: accuracy vs speed tradeoff
    - TTS: quality vs latency; streaming support
    - Image/video: a simple in-house server (diffusers/torch) vs larger workflow systems (explicitly deprioritized)
    - Orchestration: keep LLM model stable and cheap; avoid needless VRAM pressure
  - Provide a “disk budget” warning (MI300X VM shows large disk; still avoid uncontrolled downloads).

## Tests
- N/A (documentation), but include copy-pastable verification commands that match controller checks and expected outputs.

## Validation
- Ensure docs mention the same env vars and ports as the repo (`VLLM_STUDIO_PORT`, `VLLM_STUDIO_INFERENCE_PORT`, etc.).

## Acceptance Criteria
- A new operator can provision MI300X, follow the doc, and reach a working “ROCm + vLLM Studio + GPU telemetry” setup.
- The model recommendations are actionable and clearly marked as recommended vs experimental.
