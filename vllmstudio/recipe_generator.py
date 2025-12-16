"""Recipe generator utilities."""

from dataclasses import dataclass
import json
import math
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .models import Recipe


@dataclass
class GPUProfile:
    """Summarized GPU inventory for sizing decisions."""

    count: int
    memory_gb: float

    @classmethod
    def from_payload(cls, gpus: Optional[List[Dict]]) -> "GPUProfile":
        if not gpus:
            return cls(count=1, memory_gb=48.0)
        mem_mb = gpus[0].get("memory_total_mb") or gpus[0].get("fb_memory_usage", {}).get("total")
        if mem_mb is None:
            memory_gb = 48.0
        else:
            memory_gb = float(mem_mb) / 1024
        return cls(count=len(gpus), memory_gb=memory_gb)


@dataclass
class ModelStats:
    """Raw facts extracted from model config."""

    hidden_size: int
    num_layers: int
    intermediate_size: int
    vocab_size: int
    num_experts: int
    max_position: int
    architecture: str


def _load_model_config(model_dir: Path) -> Dict:
    config_path = model_dir / "config.json"
    if not config_path.exists():
        raise FileNotFoundError("Model has no config.json")
    with open(config_path) as f:
        return json.load(f)


def _extract_model_stats(config: Dict) -> ModelStats:
    hidden_size = int(config.get("hidden_size") or config.get("d_model") or 4096)
    num_layers = int(config.get("num_hidden_layers") or config.get("n_layer") or 32)
    vocab_size = int(config.get("vocab_size") or 32000)
    intermediate_size = int(config.get("intermediate_size") or config.get("ffn_hidden_size") or hidden_size * 4)
    num_experts = int(config.get("num_experts") or config.get("num_local_experts") or 0)
    max_position = int(
        config.get("max_position_embeddings")
        or config.get("max_sequence_length")
        or config.get("rope_scaling", {}).get("original_max_position_embeddings")
        or 32768
    )
    architecture = config.get("architectures", ["Unknown"])[0]
    return ModelStats(
        hidden_size=hidden_size,
        num_layers=num_layers,
        intermediate_size=intermediate_size,
        vocab_size=vocab_size,
        num_experts=num_experts,
        max_position=max_position,
        architecture=architecture,
    )


def _detect_quantization(model_dir: Path, config: Dict) -> Optional[str]:
    """Infer quantization from config or filename hints."""
    name = model_dir.name.lower()
    quant_cfg = str(config.get("quantization_config") or "").lower()
    fields = " ".join([name, quant_cfg])

    if "awq" in fields or "w4a16" in fields:
        return "awq"
    if "gptq" in fields:
        return "gptq"
    if "exl2" in fields or "exl3" in fields:
        return "exl2"
    if "int4" in fields or "4bit" in fields:
        return "int4"
    if "int8" in fields or "8bit" in fields:
        return "int8"
    if "fp8" in fields:
        return "fp8"
    if "bf16" in fields or "bfloat16" in fields:
        return "bf16"
    if "fp16" in fields or "float16" in fields:
        return "fp16"
    return None


def _bits_per_param(quantization: Optional[str]) -> int:
    if not quantization:
        return 16
    if quantization in {"awq", "gptq", "exl2", "exl3", "int4"}:
        return 4
    if quantization in {"int8", "fp8"}:
        return 8
    return 16


def _estimate_params_b(stats: ModelStats) -> float:
    """Estimate parameter count (billions) using a simple transformer budget."""
    attn_params = 4 * stats.hidden_size * stats.hidden_size
    mlp_params = 2 * stats.hidden_size * stats.intermediate_size
    per_layer = attn_params + mlp_params

    if stats.num_experts > 0:
        # Assume single active expert per token; scale by experts for storage
        per_layer += stats.num_experts * stats.hidden_size * stats.intermediate_size

    embeddings = stats.vocab_size * stats.hidden_size
    total_params = stats.num_layers * per_layer + embeddings
    return total_params / 1e9


def _sanitise_id(name: str) -> str:
    """Generate a safe recipe id."""
    safe = name.lower().strip()
    safe = re.sub(r"[^a-z0-9._-]+", "-", safe)
    safe = re.sub(r"-{2,}", "-", safe).strip("-")
    return safe[:64] or "model"


def generate_recipe_from_path(model_path: str, name: Optional[str], gpus: Optional[List[Dict]]) -> Tuple[Recipe, Dict]:
    """Generate a Recipe + analysis from a model directory."""
    model_dir = Path(model_path)
    if not model_dir.exists():
        raise FileNotFoundError(f"Model path {model_path} not found")

    config = _load_model_config(model_dir)
    stats = _extract_model_stats(config)
    profile = GPUProfile.from_payload(gpus)

    quantization = _detect_quantization(model_dir, config)
    bits = _bits_per_param(quantization)

    params_b = _estimate_params_b(stats)
    size_gb = params_b * bits / 8

    # TP sizing heuristic: keep <=60% of memory per GPU for weights
    target_per_gpu = profile.memory_gb * 0.6
    tp_size = max(1, min(profile.count, math.ceil(size_gb / max(target_per_gpu, 1e-3))))

    # Context heuristics based on size
    max_ctx = min(stats.max_position, 131072)
    if size_gb > profile.memory_gb * profile.count:
        max_ctx = min(max_ctx, 32768)
    elif size_gb > profile.memory_gb * profile.count * 0.75:
        max_ctx = min(max_ctx, 65536)

    kv_dtype = "fp8" if bits >= 8 and profile.count >= 4 else "auto"
    gpu_util = 0.90 if bits <= 8 else 0.85

    tool_parser = None
    lowered = model_dir.name.lower()
    if "qwen" in lowered:
        tool_parser = "qwen25"
    elif any(tok in lowered for tok in ["llama", "mixtral", "mistral"]):
        tool_parser = "llama3_json"
    elif "hermes" in lowered:
        tool_parser = "hermes"

    recipe = Recipe(
        id=_sanitise_id(name or model_dir.name),
        name=name or model_dir.name,
        model_path=str(model_dir),
        backend="vllm",
        tensor_parallel_size=tp_size,
        pipeline_parallel_size=1,
        data_parallel_size=1,
        max_model_len=max_ctx,
        gpu_memory_utilization=gpu_util,
        kv_cache_dtype=kv_dtype,
        swap_space=16,
        max_num_seqs=12 if size_gb < 80 else 6,
        max_num_batched_tokens=max(2048, max_ctx // 4),
        block_size=32,
        enable_expert_parallel=stats.num_experts > 1,
        disable_custom_all_reduce=tp_size > 1,
        disable_log_requests=True,
        trust_remote_code=True,
        enable_auto_tool_choice=tool_parser is not None,
        tool_call_parser=tool_parser,
        reasoning_parser=None,
        quantization=quantization,
        dtype="bfloat16" if bits == 16 else None,
    )

    analysis = {
        "estimated_params_b": round(params_b, 2),
        "estimated_size_gb": round(size_gb, 2),
        "bits_per_param": bits,
        "recommended_tp": tp_size,
        "recommended_ctx": max_ctx,
        "num_gpus_available": profile.count,
        "gpu_memory_gb": round(profile.memory_gb, 2),
        "architecture": stats.architecture,
        "is_moe": stats.num_experts > 0,
        "num_experts": stats.num_experts,
    }

    return recipe, analysis
