<!-- CRITICAL -->
# Task 03 — Fix Device Visibility Env Vars For ROCm

## Objective
Support AMD/ROCm device selection in recipes so “use GPU 0” works equivalently across CUDA and ROCm environments.

## Files Involved
- `controller/src/services/process-utilities.ts` (`buildEnvironment`)
- `controller/src/services/backends.ts` (ignore/accept internal keys)
- `controller/src/types/models.ts` (`Recipe.extra_args` usage)
- `docs/RECIPE_SYSTEM.md` (document new keys)
- `frontend/src/lib/types.ts` (Recipe typing)
- `frontend/src/app/recipes/*` (if recipe editor surfaces these fields)

## Changes
- Generalize the “visible devices” recipe key handling:
  - Support `visible_devices` as the preferred internal key.
  - Continue accepting legacy keys:
    - `cuda_visible_devices`, `CUDA_VISIBLE_DEVICES`
  - Add ROCm keys:
    - `hip_visible_devices`, `HIP_VISIBLE_DEVICES`
    - `rocr_visible_devices`, `ROCR_VISIBLE_DEVICES`
- In `buildEnvironment(recipe)`:
  - If `visible_devices` is set, apply it to:
    - CUDA: `CUDA_VISIBLE_DEVICES`
    - ROCm: `HIP_VISIBLE_DEVICES` and `ROCR_VISIBLE_DEVICES`
  - If platform detection is unavailable, set all 3 as a pragmatic fallback (document).
- Ensure these “internal keys” never become CLI flags in `appendExtraArguments`.

## Tests
- Unit tests for `buildEnvironment`:
  - ROCm mode sets HIP/ROCR.
  - CUDA mode sets CUDA.
  - Unknown mode sets all (or per decision in task-00).

## Validation
```bash
cd controller && bun test
```

## Acceptance Criteria
- A recipe can specify `visible_devices: "0"` and run correctly on ROCm by setting `HIP_VISIBLE_DEVICES=0`.
- Existing recipes using `cuda_visible_devices` keep working.
