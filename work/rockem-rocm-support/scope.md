<!-- CRITICAL -->
# Scope: Rock-Em (ROCm) Support That Works (STT/TTS/Image/Video)

## Goal
Make vLLM Studio feel native on ROCm, and ensure the non-LLM modalities are not “present but non-functional”.

1. ROCm hosts have correct GPU visibility, telemetry, and compatibility reporting.
1. The UI clearly shows platform/runtime versioning and compatibility (ROCm/HIP vs CUDA; controller/runtime versions; integration binaries + model paths).
1. STT, TTS, and image generation work end-to-end on real hardware with real models (no mocks).
1. Provide a pragmatic, real-artifact video story under repo constraints (TS-only controller; external binaries allowed).

## Constraints (Non-Negotiable)
1. **TypeScript only** for controller logic (Bun). No Python workers/services.
1. Modalities are **integrations**, invoked by the controller as child processes. They are not separate hosted services.
1. Local-only by default: no public ports required; SSH tunnels for bring-up.
1. Strict GPU lease semantics by default with explicit “replace / best-effort / cancel” UX when conflicts exist.
1. No placeholders: smoke tests must execute the real binaries against real local model files.

## What Went Wrong (Observed Issues)
The prior scope over-indexed on “plumbing exists” rather than “it works in the UI”:

1. **STT**: mic recording produced `audio/webm` and STT pipelines expected WAV; UI also assumed a “model id” rather than a local file path.
1. **TTS**: toggle existed but there was no reliable synthesis/playback loop (and autoplay policies can block audio with no explanation).
1. **Image**: integration existed but reliability depends on deterministic model location, CLI flags, output storage, and GPU lease behavior.
1. **Video**: a `video` service id existed, but there was no concrete integration and no artifacts/UI flow.

## Deliverables (Definition Of Done)
### A) STT Works From The Chat Mic
1. Chat mic recording transcribes into input text without requiring an external `VOICE_URL`.
1. Controller accepts browser audio formats (at minimum `audio/webm`) by transcoding to WAV via `ffmpeg` when needed.
1. UI error states are explicit:
   - missing `ffmpeg`
   - missing STT CLI
   - missing model file (and where it was expected)

### B) TTS Produces Audible Output
1. TTS is wired end-to-end (controller synthesis + UI playback).
1. UX is debuggable:
   - show a clear message when playback is blocked by browser autoplay policies
   - surface GPU lease conflicts when applicable

### C) Image Generation Is Deterministic + Visible
1. `POST /v1/images/generations` reliably produces:
   - a previewable image in the UI, and
   - a persisted artifact on disk.
1. GPU lease conflicts are mapped to the UI “replace / best-effort / cancel” flow.
1. The UI shows which image runtime is used and its version (via service version probing).

### D) Video Has A Real Output Path (No Stubs)
We must implement one of these (in this order of preference):

1. A cross-vendor CLI integration that runs a real video generation model and returns an `mp4`/`webm` artifact.
1. If no viable cross-vendor video CLI exists under TS-only constraints:
   - a controller-orchestrated pipeline that generates frames (image integration) and assembles a real `mp4` using `ffmpeg`.
   - this still counts as “real output”, but must be labeled clearly as a frame-synthesis pipeline.

### E) One-Command Setup + Smoke Test
1. An idempotent setup script provisions:
   - required packages (`ffmpeg`, build tools)
   - STT/TTS/image binaries
   - downloads real models into the expected directories
   - writes controller env defaults
1. A smoke test script validates:
   - STT returns non-empty text for a sample audio file
   - TTS returns a playable WAV file
   - image generation returns a valid PNG
   - video path produces a playable video artifact (for whichever approach we implement)

## Out Of Scope (For This Iteration)
1. Distributed training or multi-node orchestration.
1. Public hosting/security hardening beyond local-only tunneling (API keys, rate limiting, etc.).
1. Full “model zoo” UI installer. We will ship deterministic operator scripts and compatibility/error reporting instead.

## Success Criteria
On a provisioned ROCm host (and similarly on CUDA when available):

1. Open UI, record audio, get transcription.
1. Send a message, enable TTS, hear the assistant response.
1. Generate an image, view it in the UI, and confirm it exists on disk.
1. Generate a video (via the chosen approach) and obtain a playable artifact.

