"""vLLM backend implementation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from ..models import Recipe
from .interface import InferenceBackend


def _python_from_venv(venv_path: Optional[str]) -> Optional[str]:
    if not venv_path:
        return None
    p = Path(venv_path)
    if p.is_file() and p.name.startswith("python"):
        return str(p)
    candidate = p / "bin" / "python"
    if candidate.exists():
        return str(candidate)
    candidate = p / ".venv" / "bin" / "python"
    if candidate.exists():
        return str(candidate)
    return None


class VLLMBackend(InferenceBackend):
    name = "vllm"

    @staticmethod
    def _rope_scaling_overrides(recipe: Recipe) -> Optional[dict]:
        if recipe.rope_scaling and isinstance(recipe.rope_scaling, dict):
            return recipe.rope_scaling
        extra = recipe.extra_args if isinstance(recipe.extra_args, dict) else {}
        hf_overrides = extra.get("hf_overrides")
        if isinstance(hf_overrides, dict) and isinstance(hf_overrides.get("rope_scaling"), dict):
            return hf_overrides.get("rope_scaling")
        return None

    @classmethod
    def _should_allow_long_max_len(cls, recipe: Recipe) -> bool:
        rope = cls._rope_scaling_overrides(recipe)
        if not rope:
            return False
        original = rope.get("original_max_position_embeddings") if isinstance(rope, dict) else None
        try:
            original_val = int(original) if original is not None else None
        except Exception:
            original_val = None
        if not original_val:
            return False
        return int(recipe.max_model_len) > int(original_val)

    def build_launch_command(self, recipe: Recipe) -> list[str]:
        python_exe = recipe.python_path or _python_from_venv(getattr(recipe, "venv_path", None))
        if python_exe:
            cmd = [python_exe, "-m", "vllm.entrypoints.openai.api_server", "--model", recipe.model_path]
        else:
            cmd = ["vllm", "serve", recipe.model_path]

        cmd.extend(["--host", recipe.host, "--port", str(recipe.port)])

        if recipe.served_model_name:
            cmd.extend(["--served-model-name", recipe.served_model_name])

        if recipe.allowed_local_media_path:
            cmd.extend(["--allowed-local-media-path", recipe.allowed_local_media_path])

        if recipe.tensor_parallel_size > 1:
            cmd.extend(["--tensor-parallel-size", str(recipe.tensor_parallel_size)])
        if recipe.pipeline_parallel_size > 1:
            cmd.extend(["--pipeline-parallel-size", str(recipe.pipeline_parallel_size)])
        if recipe.data_parallel_size > 1:
            cmd.extend(["--data-parallel-size", str(recipe.data_parallel_size)])

        if recipe.kv_cache_dtype != "auto":
            cmd.extend(["--kv-cache-dtype", recipe.kv_cache_dtype])
        cmd.extend(["--max-model-len", str(recipe.max_model_len)])
        cmd.extend(["--gpu-memory-utilization", str(recipe.gpu_memory_utilization)])
        cmd.extend(["--swap-space", str(recipe.swap_space)])

        cmd.extend(["--block-size", str(recipe.block_size)])
        cmd.extend(["--max-num-seqs", str(recipe.max_num_seqs)])
        cmd.extend(["--max-num-batched-tokens", str(recipe.max_num_batched_tokens)])

        if recipe.enable_expert_parallel:
            cmd.append("--enable-expert-parallel")
        if recipe.disable_custom_all_reduce:
            cmd.append("--disable-custom-all-reduce")
        if recipe.disable_log_requests:
            cmd.append("--disable-log-requests")
        if recipe.trust_remote_code:
            cmd.append("--trust-remote-code")

        if recipe.tool_call_parser:
            cmd.extend(["--tool-call-parser", recipe.tool_call_parser])
            if recipe.enable_auto_tool_choice:
                cmd.append("--enable-auto-tool-choice")
        if recipe.reasoning_parser:
            cmd.extend(["--reasoning-parser", recipe.reasoning_parser])

        if recipe.quantization:
            cmd.extend(["--quantization", recipe.quantization])
        if recipe.dtype:
            cmd.extend(["--dtype", recipe.dtype])
        if recipe.calculate_kv_scales:
            cmd.append("--calculate-kv-scales")

        # vLLM >= 0.11 uses --hf-overrides to modify HF config fields like rope_scaling.
        hf_overrides = None
        existing = recipe.extra_args.get("hf_overrides") if isinstance(recipe.extra_args, dict) else None
        if isinstance(existing, dict):
            hf_overrides = dict(existing)
        elif existing is None:
            hf_overrides = {}

        if recipe.rope_scaling:
            if hf_overrides is None:
                hf_overrides = {"rope_scaling": recipe.rope_scaling}
            else:
                hf_overrides["rope_scaling"] = recipe.rope_scaling

        if isinstance(hf_overrides, dict) and hf_overrides:
            cmd.extend(["--hf-overrides", json.dumps(hf_overrides)])

        for key, value in recipe.extra_args.items():
            if key is None:
                continue
            key_str = str(key).lstrip("-").replace("_", "-")
            flag = f"--{key_str}"
            if flag == "--hf-overrides":
                # Avoid emitting duplicates if we already emitted a merged --hf-overrides above.
                continue
            if value is True:
                cmd.append(flag)
            elif value is not False and value is not None:
                if isinstance(value, (dict, list)):
                    cmd.extend([flag, json.dumps(value)])
                else:
                    cmd.extend([flag, str(value)])

        return cmd

    def build_launch_env(self, recipe: Recipe) -> dict[str, str]:
        env = super().build_launch_env(recipe)
        # vLLM 0.11+ rejects max_model_len > config-derived max unless this env var is set.
        # Only auto-set when the recipe explicitly applies RoPE scaling beyond original max.
        if "VLLM_ALLOW_LONG_MAX_MODEL_LEN" not in env and self._should_allow_long_max_len(recipe):
            env["VLLM_ALLOW_LONG_MAX_MODEL_LEN"] = "1"
        return env
