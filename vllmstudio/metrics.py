"""Helpers for parsing vLLM Prometheus metrics."""

from collections import deque
from dataclasses import dataclass, field
import re
import time
from typing import Dict, List, Optional, Deque


@dataclass
class ThroughputSample:
    """A single throughput measurement."""
    timestamp: float
    prompt_tps: float
    generation_tps: float


@dataclass
class MetricsState:
    """Track counters between scrapes to compute throughput with rolling averages."""

    last_prompt_tokens: float = 0.0
    last_generation_tokens: float = 0.0
    last_timestamp: float = 0.0

    # Rolling window for throughput averaging (last 60 seconds of samples)
    throughput_samples: Deque[ThroughputSample] = field(default_factory=lambda: deque(maxlen=100))

    # Store cumulative TTFT for averaging
    ttft_samples: Deque[float] = field(default_factory=lambda: deque(maxlen=100))
    last_ttft_sum: float = 0.0
    last_ttft_count: float = 0.0

    def update(self, prompt_tokens: float, gen_tokens: float, timestamp: float) -> None:
        self.last_prompt_tokens = prompt_tokens
        self.last_generation_tokens = gen_tokens
        self.last_timestamp = timestamp

    def add_throughput_sample(self, prompt_tps: float, gen_tps: float) -> None:
        """Add a throughput sample to the rolling window."""
        now = time.time()
        self.throughput_samples.append(ThroughputSample(now, prompt_tps, gen_tps))

        # Remove samples older than 60 seconds
        cutoff = now - 60.0
        while self.throughput_samples and self.throughput_samples[0].timestamp < cutoff:
            self.throughput_samples.popleft()

    def get_avg_throughput(self) -> tuple[Optional[float], Optional[float]]:
        """Get rolling average throughput over the sample window."""
        if not self.throughput_samples:
            return None, None

        # Filter to last 60 seconds and only non-zero samples for generation
        now = time.time()
        cutoff = now - 60.0

        prompt_samples = []
        gen_samples = []

        for sample in self.throughput_samples:
            if sample.timestamp >= cutoff:
                if sample.prompt_tps > 0:
                    prompt_samples.append(sample.prompt_tps)
                if sample.generation_tps > 0:
                    gen_samples.append(sample.generation_tps)

        avg_prompt = round(sum(prompt_samples) / len(prompt_samples), 2) if prompt_samples else 0.0
        avg_gen = round(sum(gen_samples) / len(gen_samples), 2) if gen_samples else 0.0

        return avg_prompt, avg_gen

    def add_ttft_sample(self, ttft_ms: float) -> None:
        """Add a TTFT sample."""
        self.ttft_samples.append(ttft_ms)

    def get_avg_ttft(self) -> Optional[float]:
        """Get rolling average TTFT."""
        if not self.ttft_samples:
            return None
        return round(sum(self.ttft_samples) / len(self.ttft_samples), 2)


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
        "kv_cache_usage": round(parsed["kv_cache_usage"], 4) if parsed["kv_cache_usage"] is not None else None,
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

    # TTFT - track new samples and compute rolling average
    ttft_sum = parsed.get("ttft_sum")
    ttft_count = parsed.get("ttft_count")
    if ttft_sum is not None and ttft_count is not None:
        # Check if there are new TTFT samples
        if ttft_count > state.last_ttft_count and state.last_ttft_count > 0:
            new_samples = int(ttft_count - state.last_ttft_count)
            new_sum = ttft_sum - state.last_ttft_sum
            if new_samples > 0 and new_sum > 0:
                avg_new_ttft = (new_sum / new_samples) * 1000  # Convert to ms
                for _ in range(min(new_samples, 10)):  # Add up to 10 samples at a time
                    state.add_ttft_sample(avg_new_ttft)

        state.last_ttft_sum = ttft_sum
        state.last_ttft_count = ttft_count

        # Use rolling average if available, otherwise fall back to cumulative
        rolling_ttft = state.get_avg_ttft()
        if rolling_ttft is not None:
            metrics["avg_ttft_ms"] = rolling_ttft
        elif ttft_count > 0:
            metrics["avg_ttft_ms"] = round((ttft_sum / ttft_count) * 1000, 2)

    # TPOT average (cumulative is fine for this)
    tpot_sum = parsed.get("tpot_sum")
    tpot_count = parsed.get("tpot_count")
    if tpot_sum is not None and tpot_count and tpot_count > 0:
        metrics["avg_tpot_ms"] = round((tpot_sum / tpot_count) * 1000, 2)

    # Instantaneous throughput from monotonic counters
    prompt_tokens = parsed.get("prompt_tokens_total")
    gen_tokens = parsed.get("generation_tokens_total")
    instant_prompt_tps = 0.0
    instant_gen_tps = 0.0

    if state.last_timestamp > 0 and prompt_tokens is not None and gen_tokens is not None:
        elapsed = now - state.last_timestamp
        if elapsed > 0.5:
            prompt_delta = prompt_tokens - state.last_prompt_tokens
            gen_delta = gen_tokens - state.last_generation_tokens
            if prompt_delta >= 0:
                instant_prompt_tps = prompt_delta / elapsed
            if gen_delta >= 0:
                instant_gen_tps = gen_delta / elapsed

            # Add to rolling average (only if there was actual throughput)
            if instant_prompt_tps > 0 or instant_gen_tps > 0:
                state.add_throughput_sample(instant_prompt_tps, instant_gen_tps)

    # Get rolling averages for display
    avg_prompt_tps, avg_gen_tps = state.get_avg_throughput()
    metrics["prompt_throughput"] = avg_prompt_tps
    metrics["generation_throughput"] = avg_gen_tps

    if prompt_tokens is not None and gen_tokens is not None:
        state.update(prompt_tokens, gen_tokens, now)

    return metrics
