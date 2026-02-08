<!-- CRITICAL -->
# Task 00 — Define The ROCm/Platform Data Model

## Objective
Define a minimal, forward-compatible “platform” data model that cleanly supports ROCm and CUDA, then thread it through controller types and frontend types without breaking existing consumers.

## Files Involved
- `controller/src/types/models.ts`
- `controller/src/services/runtime-info.ts`
- `controller/src/routes/system.ts` (`/config`, `/gpus`)
- `frontend/src/lib/types.ts`
- `frontend/src/app/configs/_components/configs-view.tsx`

## Changes
- Add a platform section to the controller runtime payload:
  - Introduce `RuntimePlatformKind = "cuda" | "rocm" | "unknown"`.
  - Add `runtime.platform` (kind + vendor + details) to `SystemRuntimeInfo`.
  - Keep `runtime.cuda` for backward compatibility but allow it to be `null` or “empty” when platform is ROCm.
- Add a ROCm info structure:
  - `rocm_version` (string|null)
  - `hip_version` (string|null)
  - `smi_tool` (`"amd-smi" | "rocm-smi" | null`)
  - `gpu_arch` (array of `gfx*` strings if detectable)
- Add a Torch build info structure (high leverage for compatibility):
  - `torch_version`
  - `torch_cuda` (string|null)
  - `torch_hip` (string|null)
- Update the frontend type mirror (`frontend/src/lib/types.ts`) to include the new platform/rocm/torch sections, with strict nullability.
- Update `frontend/src/app/configs/_components/configs-view.tsx` to render ROCm fields when present and not show “CUDA Driver/Runtime” for ROCm as the primary fields.

## Tests
- Controller:
  - Add a small unit test for “platform model serialization” by calling `getSystemRuntimeInfo` with mocked command runners (introduced in a later task).
- Frontend:
  - Add a unit test that renders the Config “Hardware” card in ROCm mode and asserts ROCm fields are used.

## Validation
```bash
cd controller && bun run typecheck && bun test
cd ../frontend && npm test
```

## Acceptance Criteria
- `GET /config` includes a `runtime.platform.kind` field.
- Frontend continues to compile with strict TS types.
- Config page can show ROCm fields without runtime crashes when CUDA info is absent.
