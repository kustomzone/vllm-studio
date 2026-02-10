# llama.cpp RPC (Parallax-Style Cross-Host Split)

This repo can run a *single* GGUF model split across multiple machines by using **llama.cpp RPC**:

- One machine runs `rpc-server` (worker).
- Another machine runs `llama-server` (OpenAI-compatible HTTP server) and connects to the worker(s) via `--rpc`.

This is the same *class* of idea as Parallax: **pipeline-style sharding with activation streaming**, not vLLM tensor-parallel all-reduce.

## What This Enables

- “Half the layers on NVIDIA, half on AMD” style splits (layer/pipeline sharding).
- Heterogeneous workers are possible as long as they can run their shard (e.g., CUDA on one box, HIP/ROCm on another).

## Key Notes

- Prefer `--split-mode layer` for RPC sharding. (Row split is not generally effective with RPC workers.)
- RPC should be treated as a LAN-only primitive. If you must cross the public internet, use SSH tunnels and do not expose `rpc-server` directly.

## Quick Start (Operator Flow)

### 1) Start an AMD worker (rpc-server)

On the AMD box (ROCm/HIP build of llama.cpp):

```bash
~/src/llama.cpp/build/bin/rpc-server \
  --host 0.0.0.0 \
  --port 50052 \
  --mem 16000
```

Notes:
- `--mem` is the worker’s memory budget (MiB). Increase it for large models and big KV caches.
- Keep this running.

### 2) Start llama-server on the NVIDIA host with `--rpc`

On the NVIDIA box (CUDA build of llama.cpp), start your normal llama-server **but add**:

```bash
--rpc 23.183.40.84:50052
```

In vLLM Studio, you do this by adding **Extra CLI Arguments** to a llama.cpp recipe:

- `rpc`: `23.183.40.84:50052`
- `split-mode`: `layer`
- `tensor-split`: `1,1` (equal split across local+remote devices; tune as needed)
- `gpu-layers`: `all` (or a large number)

The UI now has a dedicated field for this:
- Recipes -> llama.cpp -> Resources -> `RPC Workers`

## Automation Script

See: `scripts/rockem/llamacpp-rpc-split.ts`

It:
- Starts `rpc-server` on the AMD machine (via SSH).
- Creates/starts a llama.cpp recipe on the NVIDIA controller that points at the AMD worker via `--rpc`.

