<!-- CRITICAL -->
# Orchestration (Temporal Jobs)

VLLM Studio can orchestrate multi-step jobs (STT -> LLM -> TTS, image/video, etc.) using **Temporal**.

This repo currently ships a minimal vertical slice:

- Job type: `voice_assistant_turn`
- Steps:
  - (optional) STT: transcribe `audio_base64`
  - LLM: generate response text via controller `ChatRunManager`
  - TTS: synthesize WAV via Piper CLI integration

Job progress/state is persisted durably in the controller's SQLite `JobStore`, and workflow activities update that state as they run.

## Bring-Up

1. Start Temporal (local):

```bash
docker compose up temporal -d
```

2. Start the controller with the Temporal address (default `localhost:7233`):

```bash
cd controller
bun src/main.ts
```

3. Confirm Temporal status is visible in SSE:

- `GET /events` includes `temporal_status`

## Running Jobs

Create a job:

```bash
curl -sS -X POST http://127.0.0.1:8080/jobs \\
  -H 'Content-Type: application/json' \\
  -d '{
    "type": "voice_assistant_turn",
    "input": {
      "text": "Hello",
      "tts_model": "en_US-amy.onnx"
    }
  }'
```

List jobs:

```bash
curl -sS http://127.0.0.1:8080/jobs
```

Get job details:

```bash
curl -sS http://127.0.0.1:8080/jobs/<job_id>
```

## Notes

- Temporal is enabled automatically when reachable; otherwise jobs fall back to an in-process runner.
- For strict Temporal-only mode, set `VLLM_STUDIO_JOBS_ORCHESTRATOR=temporal`.
- For in-process only, set `VLLM_STUDIO_JOBS_ORCHESTRATOR=memory`.
