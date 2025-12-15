import json
import time
from pathlib import Path

import pytest

from vllmstudio.recipe_generator import generate_recipe_from_path
from vllmstudio.metrics import MetricsState, parse_vllm_metrics
from vllmstudio.recipe_manager import RecipeManager
from vllmstudio.models import Recipe, RecipeStatus
from vllmstudio.process_manager import ProcessManager


def _write_config(model_dir: Path, **overrides):
    config = {
        "hidden_size": 4096,
        "num_hidden_layers": 32,
        "vocab_size": 32000,
        "intermediate_size": 16384,
        "max_position_embeddings": 32768,
        "architectures": ["TestModel"],
    }
    config.update(overrides)
    (model_dir / "config.json").write_text(json.dumps(config))


def test_generate_recipe_detects_quantization_and_scaling(tmp_path):
    model_dir = tmp_path / "Qwen3-14B-AWQ"
    model_dir.mkdir()
    _write_config(model_dir, hidden_size=5120, num_hidden_layers=40)

    gpus = [{"memory_total_mb": 48000}, {"memory_total_mb": 48000}]
    recipe, analysis = generate_recipe_from_path(str(model_dir), None, gpus)

    assert recipe.quantization == "awq"
    assert analysis["bits_per_param"] == 4
    assert recipe.tensor_parallel_size >= 1
    assert recipe.max_model_len <= 131072
    assert recipe.id.startswith("qwen3-14b-awq")


def test_generate_recipe_scales_tp_for_large_models(tmp_path):
    big_dir = tmp_path / "Llama3-400B"
    big_dir.mkdir()
    _write_config(
        big_dir,
        hidden_size=8192,
        num_hidden_layers=80,
        vocab_size=130000,
        intermediate_size=28672,
    )

    gpus = [{"memory_total_mb": 24576}, {"memory_total_mb": 24576}]
    recipe, analysis = generate_recipe_from_path(str(big_dir), "Llama3 400B", gpus)

    # Model is too big for a single 24GB GPU, expect TP>1 and ctx capped
    assert recipe.tensor_parallel_size == 2
    assert analysis["recommended_ctx"] <= 65536


def test_metrics_parser_tracks_throughput():
    metrics_text = """
vllm:num_requests_running{} 2
vllm:num_requests_waiting{} 1
vllm:kv_cache_usage_perc{} 0.5
vllm:prompt_tokens_total{} 100
vllm:generation_tokens_total{} 200
vllm:prefix_cache_queries_total{} 10
vllm:prefix_cache_hits_total{} 7
vllm:time_to_first_token_seconds_sum{} 1.2
vllm:time_to_first_token_seconds_count{} 4
vllm:time_per_output_token_seconds_sum{} 2.4
vllm:time_per_output_token_seconds_count{} 6
vllm:request_success_total{finished_reason="stop"} 9
"""
    state = MetricsState()
    first = parse_vllm_metrics(metrics_text, state)
    assert first["running_requests"] == 2
    assert first["prefix_cache_hit_rate"] == 70.0
    assert first["prompt_throughput"] is None

    time.sleep(0.6)
    metrics_text_b = metrics_text.replace("100", "140", 1).replace("200", "280", 1)
    second = parse_vllm_metrics(metrics_text_b, state)
    assert second["prompt_throughput"] and second["prompt_throughput"] > 0
    assert second["generation_throughput"] and second["generation_throughput"] > 0


def test_recipe_manager_persists_and_reports_status(tmp_path, monkeypatch):
    manager = RecipeManager(recipes_dir=tmp_path)
    recipe = Recipe(
        id="test-recipe",
        name="Test",
        model_path="/tmp/model",
        backend="vllm",
    )
    manager.save_recipe(recipe)

    assert manager.get_recipe("test-recipe")
    monkeypatch.setattr(ProcessManager, "get_current_process", staticmethod(lambda port=8000: None))
    statuses = manager.get_recipes_with_status()
    assert statuses[0].status == RecipeStatus.STOPPED
