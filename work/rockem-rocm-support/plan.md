<!-- CRITICAL -->
# Execution Plan: Rock-Em (ROCm) First-Class Support

## Status (As Of 2026-02-08)
- Milestones A-E implemented in the controller + frontend.
- ROCm platform + GPU visibility (`/gpus`, `/config`, `/compat`) and UI indicators.
- Cross-vendor `visible_devices` env handling (CUDA/HIP/ROCR).
- Rock-Em services layer (`/services`) with strict GPU lease + replace/best-effort UX.
- CLI-driven STT/TTS (`/v1/audio/*`) and image generation (`/v1/images/generations`) integrations.
- Feature-flagged VLM attachments via OpenAI-compatible multimodal content.
- Jobs + orchestration (Temporal-backed when available, in-memory fallback) with `/jobs` API and UI.
- Validation: controller `typecheck`, `test`, `lint`; frontend `test`, `lint`, `build`, Playwright E2E all passing locally.

## Start Here (Bring-Up Checklist)
1. VM is provisioned: `enc1-gpuvm002` (`1x MI300X`) and reachable over SSH.
1. Controller is running on the VM (local): `http://127.0.0.1:8080`.
1. Use SSH port-forwarding to access controller safely from your machine:
   - `ssh -N -L 18080:127.0.0.1:8080 hotaisle@23.183.40.67`

If any of the above is missing, follow `work/rockem-rocm-support/provisioning.md`.

## Milestone A: ROCm Visibility (Unblocks UI + Everything Else)
Objective: On MI300X, `/gpus` and `/config` clearly report ROCm + GPU count/types, and the UI shows “Platform: ROCm”.

Do in this order:
1. `task-00.md`: define platform model in controller + frontend types.
1. `task-01.md`: implement `amd-smi`/`rocm-smi` GPU telemetry; make `/gpus` non-empty on MI300X.
1. `task-02.md`: add ROCm/HIP + Torch build visibility to `/config`.
1. `task-04.md`: platform-aware warnings + dashboard status indicator.
1. `task-05.md`: compatibility panel so “why doesn’t it work” is answerable in one place.

Deploy loop:
1. Implement locally in this repo.
1. Run controller tests locally: `cd controller && bun run typecheck && bun test`.
1. Push changes to the VM:
   - simplest: `git pull` on VM
   - restart controller process
1. Verify on VM:
   - `curl http://127.0.0.1:8080/gpus`
   - `curl http://127.0.0.1:8080/config`

## Milestone B: Correct ROCm Device Selection
Objective: recipes can target devices on ROCm (HIP/ROCR env vars) and UI can explain what it applied.

Do:
1. `task-03.md`: implement `visible_devices` and ROCm env var behavior.

## Milestone C: Rock-Em Service Layer + Concurrency Semantics
Objective: controller can track multiple “services” and enforce strict GPU lease by default.

Do:
1. `task-09.md`: ServiceManager + `/services` API + UI Runtimes panel.
1. `task-10.md`: strict GPU lease + replace/best-effort UX.

## Milestone D: Modalities As Integrations (CLI-Driven)
Objective: controller brokers STT/TTS/image requests to external CLI tools, with health/version/model listing and lease usage.

Do:
1. `task-13.md`: STT + TTS endpoints + adapters.
1. `task-14.md`: image generation via a CLI adapter (`/v1/images/generations`).

## Milestone E: VLM End-to-End (Agent Mode)
Objective: image attachments are real multimodal content (not placeholders) and capabilities are visible.

Do:
1. `task-08.md`: VLM through the agent runtime.
1. `task-11.md`/`task-12.md` (as applicable): feature flags + UI affordances.

## Operational Guardrails
- Keep ports closed to the internet during bring-up; use SSH tunnels.
- Add controller API key before opening any ports publicly (and confirm UI supports it end-to-end).
- Delete the VM when not in active use to stop billing (billing continues powered off).
