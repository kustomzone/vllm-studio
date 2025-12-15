"""Helpers for parsing vLLM Prometheus metrics."""

from dataclasses import dataclass
import re
import time
from typing import Dict, Optional


@dataclass
class MetricsState:
    """Track counters between scrapes to compute throughput."""

    last_prompt_tokens: float = 0.0
    last_generation_tokens: float = 0.0
    last_timestamp: float = 0.0

    def update(self, prompt_tokens: float, gen_tokens: float, timestamp: float) -> None:
        self.last_prompt_tokens = prompt_tokens
        self.last_generation_tokens = gen_tokens
        self.last_timestamp = timestamp


PROMETHEUS_PATTERNS = {
    "running_requests": r"vllm:num_requests_running\{[^}]*\}\s+([\d.e+-]+)",
    "pending_requests": r"vllm:num_requests_waiting\{[^}]*\}\s+([\d.e+-]+)",
    "kv_cache_usage": r"vllm:kv_cache_usage_perc\{[^}]*\}\s+([\d.e+-]+)",
    "prompt_tokens_total": r"vllm:prompt_tokens_total\{[^}]*\}\s+([\d.e+-]+)",
    "generation_tokens_total": r"vllm:generation_tokens_total\{[^}]*\}\s+([\d.e+-]+)",
    "prefix_cache_queries": r"vllm:prefix_cache_queries_total\{[^}]*\}\s+([\d.e+-]+)",
    "prefix_cache_hits": r"vllm:prefix_cache_hits_total\{[^}]*\}\s+([\d.e+-]+)",
    "ttft_sum": r"vllm:time_to_first_token_seconds_sum\{[^}]*\}\s+([\d.e+-]+)",
    "ttft_count": r"vllm:time_to_first_token_seconds_count\{[^}]*\}\s+([\d.e+-]+)",
    "tpot_sum": r"vllm:time_per_output_token_seconds_sum\{[^}]*\}\s+([\d.e+-]+)",
    "tpot_count": r"vllm:time_per_output_token_seconds_count\{[^}]*\}\s+([\d.e+-]+)",
    "request_success": r'vllm:request_success_total\{[^}]*finished_reason="stop"[^}]*\}\s+([\d.e+-]+)',
}


def _match_float(text: str, pattern: str) -> Optional[float]:
    """Return first float match for a Prometheus pattern."""
    match = re.search(pattern, text)
    if not match:
        return None
    try:
        return float(match.group(1))
    except (ValueError, TypeError):
        return None


def parse_vllm_metrics(text: str, state: MetricsState) -> Dict[str, Optional[float]]:
    """Parse vLLM Prometheus metrics text into a structured dict.

    Args:
        text: Raw Prometheus metrics response from vLLM.
        state: Mutable MetricsState for throughput calculations.
    """
    now = time.time()
    parsed = {key: _match_float(text, pattern) for key, pattern in PROMETHEUS_PATTERNS.items()}

    metrics: Dict[str, Optional[float]] = {
        "running_requests": int(parsed["running_requests"]) if parsed["running_requests"] is not None else None,
        "pending_requests": int(parsed["pending_requests"]) if parsed["pending_requests"] is not None else None,
        "kv_cache_usage": round(parsed["kv_cache_usage"] * 100, 2) if parsed["kv_cache_usage"] is not None else None,
        "prompt_tokens_total": int(parsed["prompt_tokens_total"]) if parsed["prompt_tokens_total"] is not None else None,
        "generation_tokens_total": int(parsed["generation_tokens_total"]) if parsed["generation_tokens_total"] is not None else None,
        "prefix_cache_hit_rate": None,
        "avg_ttft_ms": None,
        "avg_tpot_ms": None,
        "prompt_throughput": None,
        "generation_throughput": None,
        "request_success": int(parsed["request_success"]) if parsed["request_success"] is not None else None,
    }

    # Prefix cache hit rate
    queries = parsed.get("prefix_cache_queries")
    hits = parsed.get("prefix_cache_hits")
    if queries and queries > 0 and hits is not None:
        metrics["prefix_cache_hit_rate"] = round((hits / queries) * 100, 2)

    # Averages
    ttft_sum = parsed.get("ttft_sum")
    ttft_count = parsed.get("ttft_count")
    if ttft_sum is not None and ttft_count and ttft_count > 0:
        metrics["avg_ttft_ms"] = round((ttft_sum / ttft_count) * 1000, 2)

    tpot_sum = parsed.get("tpot_sum")
    tpot_count = parsed.get("tpot_count")
    if tpot_sum is not None and tpot_count and tpot_count > 0:
        metrics["avg_tpot_ms"] = round((tpot_sum / tpot_count) * 1000, 2)

    # Throughput from monotonic counters
    prompt_tokens = parsed.get("prompt_tokens_total")
    gen_tokens = parsed.get("generation_tokens_total")
    if state.last_timestamp > 0 and prompt_tokens is not None and gen_tokens is not None:
        elapsed = now - state.last_timestamp
        if elapsed > 0.5:
            prompt_delta = prompt_tokens - state.last_prompt_tokens
            gen_delta = gen_tokens - state.last_generation_tokens
            if prompt_delta >= 0:
                metrics["prompt_throughput"] = round(prompt_delta / elapsed, 2)
            if gen_delta >= 0:
                metrics["generation_throughput"] = round(gen_delta / elapsed, 2)

    if prompt_tokens is not None and gen_tokens is not None:
        state.update(prompt_tokens, gen_tokens, now)

    return metrics
