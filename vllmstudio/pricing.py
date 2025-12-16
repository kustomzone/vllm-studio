"""Token cost estimation helpers.

This is intentionally optional: if no pricing is configured, cost is None.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Optional, Any

from .config import settings


@lru_cache(maxsize=1)
def _load_pricing() -> dict[str, dict[str, float]]:
    raw = getattr(settings, "token_pricing_json", None)
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return {}
        out: dict[str, dict[str, float]] = {}
        for model, rates in parsed.items():
            if not isinstance(model, str) or not isinstance(rates, dict):
                continue
            prompt = float(rates.get("prompt_per_1k", 0.0) or 0.0)
            completion = float(rates.get("completion_per_1k", 0.0) or 0.0)
            out[model] = {"prompt_per_1k": prompt, "completion_per_1k": completion}
        return out
    except Exception:
        return {}


def estimate_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> Optional[float]:
    pricing = _load_pricing()
    if not pricing:
        return None
    rates = pricing.get(model) or pricing.get("default")
    if not rates:
        return None
    prompt_rate = float(rates.get("prompt_per_1k", 0.0) or 0.0)
    completion_rate = float(rates.get("completion_per_1k", 0.0) or 0.0)
    cost = (prompt_tokens / 1000.0) * prompt_rate + (completion_tokens / 1000.0) * completion_rate
    # Avoid returning noisy zeros
    return cost if cost > 0 else None

