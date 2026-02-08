<!-- CRITICAL -->
# Task 07 — “Real” VLM Image Attachments (Direct OpenAI Path, Feature-Flagged)

## Objective
Enable sending actual image content to VLM-capable backends (vLLM/SGLang) by using OpenAI-style multimodal message parts, without destabilizing the existing Pi-mono agent runtime.

## Files Involved
- `frontend/src/app/chat/_components/layout/chat-page.tsx`
- `frontend/src/lib/api.ts` (or wherever OpenAI requests are made)
- `controller/src/routes/openai.ts` (OpenAI-compatible passthrough)
- `frontend/src/lib/types.ts` (chat message part typing, if needed)
- New feature flag helper (frontend + controller): `frontend/src/lib/features.ts`, `controller/src/config/features.ts` (if not already present)

## Changes
- Add a feature flag: `VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1` (names can be finalized in task-00/rules).
- Frontend:
  - When attachments include images and the feature flag is enabled:
    - Build OpenAI `messages` where the user message `content` is an array:
      - `{ type: "text", text: "..." }`
      - `{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }`
    - POST to controller `/v1/chat/completions` (streaming) instead of `/chats/:id/turn`.
  - Keep the current behavior as the default (agent runtime path) when no images are attached or the flag is disabled.
- Controller:
  - Ensure `/v1/chat/completions` streaming path forwards the OpenAI multimodal payload unchanged to the inference backend (or LiteLLM if supported).
  - Add a small guardrail: if upstream rejects multimodal, return a clear error suggesting the user switch to a VLM-capable model/recipe.
- Persisting attachments:
  - Keep uploading to AgentFS for now (good for reproducibility), but do not rely on placeholders for inference when VLM mode is enabled.

## Tests
- Frontend unit tests:
  - “When image attachments exist and flag enabled, request payload includes `image_url` parts.”
- Controller integration test (mocked fetch to upstream):
  - `/v1/chat/completions` forwards `content: [{type:'image_url',...}]` without stripping.

## Validation
```bash
cd controller && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- With the flag enabled, a user can attach an image and the backend receives an OpenAI multimodal payload.
- With the flag disabled, behavior remains unchanged (placeholders only; agent runtime works).
