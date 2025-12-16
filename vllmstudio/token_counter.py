"""Token counting utilities using tiktoken."""

import json
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from threading import Lock

try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False


# Model to tiktoken encoding mapping
MODEL_ENCODING_MAP = {
    # OpenAI models
    "gpt-4": "cl100k_base",
    "gpt-4-turbo": "cl100k_base",
    "gpt-4o": "o200k_base",
    "gpt-3.5-turbo": "cl100k_base",
    # Default for most open models (Llama, Qwen, Mistral use similar BPE)
    "default": "cl100k_base",
}


@dataclass
class TokenUsage:
    """Token usage statistics for a single request."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0

    def to_dict(self) -> Dict[str, int]:
        """Convert to OpenAI-compatible usage dict."""
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
        }

    def to_dict_extended(self) -> Dict[str, Any]:
        """Convert to extended usage dict with cache info."""
        result = self.to_dict()
        if self.cached_tokens > 0:
            result["prompt_tokens_details"] = {
                "cached_tokens": self.cached_tokens
            }
        return result


@dataclass
class UsageLogEntry:
    """A single usage log entry."""
    timestamp: float
    request_id: str
    model: str
    usage: TokenUsage
    latency_ms: Optional[float] = None
    endpoint: str = "/v1/chat/completions"


class TokenCounter:
    """Token counter using tiktoken with caching."""

    _encoders: Dict[str, Any] = {}
    _lock = Lock()

    @classmethod
    def get_encoding(cls, model: str = "default") -> Any:
        """Get or create a tiktoken encoding for a model."""
        if not TIKTOKEN_AVAILABLE:
            return None

        # Map model to encoding name
        encoding_name = MODEL_ENCODING_MAP.get(model, MODEL_ENCODING_MAP["default"])

        with cls._lock:
            if encoding_name not in cls._encoders:
                cls._encoders[encoding_name] = tiktoken.get_encoding(encoding_name)
            return cls._encoders[encoding_name]

    @classmethod
    def count_tokens(cls, text: str, model: str = "default") -> int:
        """Count tokens in a text string."""
        if not text:
            return 0

        encoding = cls.get_encoding(model)
        if encoding is None:
            # Fallback: rough estimate of ~4 chars per token
            return len(text) // 4

        return len(encoding.encode(text))

    @classmethod
    def count_message_tokens(cls, messages: List[Dict[str, Any]], model: str = "default") -> int:
        """
        Count tokens in a list of chat messages.

        Accounts for message formatting overhead (role, content structure).
        """
        if not messages:
            return 0

        encoding = cls.get_encoding(model)
        if encoding is None:
            # Fallback estimate
            total = 0
            for msg in messages:
                content = msg.get("content", "")
                if isinstance(content, str):
                    total += len(content) // 4
                elif isinstance(content, list):
                    # Vision/multimodal content
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            total += len(part.get("text", "")) // 4
            return total + len(messages) * 4  # Overhead per message

        # Token count with message formatting overhead
        # Format: <|start|>role<|sep|>content<|end|>
        tokens_per_message = 4  # Overhead per message
        tokens_per_name = -1  # If name is present, role is omitted

        total = 0
        for msg in messages:
            total += tokens_per_message

            role = msg.get("role", "")
            total += len(encoding.encode(role))

            content = msg.get("content", "")
            if isinstance(content, str):
                total += len(encoding.encode(content))
            elif isinstance(content, list):
                # Handle multimodal content (text + images)
                for part in content:
                    if isinstance(part, dict):
                        if part.get("type") == "text":
                            total += len(encoding.encode(part.get("text", "")))
                        elif part.get("type") == "image_url":
                            # Images have variable tokens based on resolution
                            # Default estimate for high-res image
                            total += 765

            # Tool calls in assistant messages
            if "tool_calls" in msg:
                for tool_call in msg.get("tool_calls", []):
                    func = tool_call.get("function", {})
                    total += len(encoding.encode(func.get("name", "")))
                    total += len(encoding.encode(func.get("arguments", "")))
                    total += 10  # Tool call overhead

            # Function/tool results
            if msg.get("role") == "tool":
                total += 3  # Tool result overhead

            if "name" in msg:
                total += tokens_per_name
                total += len(encoding.encode(msg["name"]))

        total += 3  # Every reply is primed with <|im_start|>assistant<|im_sep|>
        return total

    @classmethod
    def count_tools_tokens(cls, tools: List[Dict[str, Any]], model: str = "default") -> int:
        """Count tokens in tool/function definitions."""
        if not tools:
            return 0

        # Serialize tools to JSON and count tokens
        tools_json = json.dumps(tools, ensure_ascii=False)
        return cls.count_tokens(tools_json, model)

    @classmethod
    def estimate_request_tokens(
        cls,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        model: str = "default"
    ) -> int:
        """Estimate total input tokens for a request."""
        total = cls.count_message_tokens(messages, model)
        if tools:
            total += cls.count_tools_tokens(tools, model)
        return total


class UsageTracker:
    """Track token usage across requests with rolling window statistics."""

    def __init__(self, max_entries: int = 10000):
        self.max_entries = max_entries
        self._entries: deque = deque(maxlen=max_entries)
        self._lock = Lock()

        # Aggregated stats
        self._total_prompt_tokens = 0
        self._total_completion_tokens = 0
        self._total_requests = 0
        self._start_time = time.time()

    def log_usage(
        self,
        request_id: str,
        model: str,
        usage: TokenUsage,
        latency_ms: Optional[float] = None,
        endpoint: str = "/v1/chat/completions"
    ):
        """Log a usage entry."""
        entry = UsageLogEntry(
            timestamp=time.time(),
            request_id=request_id,
            model=model,
            usage=usage,
            latency_ms=latency_ms,
            endpoint=endpoint
        )

        with self._lock:
            self._entries.append(entry)
            self._total_prompt_tokens += usage.prompt_tokens
            self._total_completion_tokens += usage.completion_tokens
            self._total_requests += 1

    def get_stats(self, window_seconds: Optional[int] = None) -> Dict[str, Any]:
        """Get aggregated usage statistics."""
        with self._lock:
            if not self._entries:
                return {
                    "total_requests": 0,
                    "total_prompt_tokens": 0,
                    "total_completion_tokens": 0,
                    "total_tokens": 0,
                    "uptime_seconds": time.time() - self._start_time,
                }

            if window_seconds:
                cutoff = time.time() - window_seconds
                entries = [e for e in self._entries if e.timestamp >= cutoff]
            else:
                entries = list(self._entries)

            if not entries:
                return {
                    "total_requests": 0,
                    "total_prompt_tokens": 0,
                    "total_completion_tokens": 0,
                    "total_tokens": 0,
                    "window_seconds": window_seconds,
                }

            prompt_tokens = sum(e.usage.prompt_tokens for e in entries)
            completion_tokens = sum(e.usage.completion_tokens for e in entries)
            latencies = [e.latency_ms for e in entries if e.latency_ms is not None]

            # Per-model breakdown
            model_stats = {}
            for entry in entries:
                if entry.model not in model_stats:
                    model_stats[entry.model] = {
                        "requests": 0,
                        "prompt_tokens": 0,
                        "completion_tokens": 0
                    }
                model_stats[entry.model]["requests"] += 1
                model_stats[entry.model]["prompt_tokens"] += entry.usage.prompt_tokens
                model_stats[entry.model]["completion_tokens"] += entry.usage.completion_tokens

            result = {
                "total_requests": len(entries),
                "total_prompt_tokens": prompt_tokens,
                "total_completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "avg_prompt_tokens": round(prompt_tokens / len(entries), 1),
                "avg_completion_tokens": round(completion_tokens / len(entries), 1),
                "per_model": model_stats,
            }

            if latencies:
                result["avg_latency_ms"] = round(sum(latencies) / len(latencies), 2)
                result["min_latency_ms"] = round(min(latencies), 2)
                result["max_latency_ms"] = round(max(latencies), 2)

            if window_seconds:
                time_range = entries[-1].timestamp - entries[0].timestamp if len(entries) > 1 else 1
                result["tokens_per_second"] = round((prompt_tokens + completion_tokens) / max(time_range, 1), 2)
                result["requests_per_second"] = round(len(entries) / max(time_range, 1), 3)
                result["window_seconds"] = window_seconds
            else:
                result["uptime_seconds"] = time.time() - self._start_time
                result["all_time_prompt_tokens"] = self._total_prompt_tokens
                result["all_time_completion_tokens"] = self._total_completion_tokens
                result["all_time_requests"] = self._total_requests

            return result

    def get_recent(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent usage entries."""
        with self._lock:
            entries = list(self._entries)[-limit:]
            return [
                {
                    "timestamp": e.timestamp,
                    "request_id": e.request_id,
                    "model": e.model,
                    "usage": e.usage.to_dict(),
                    "latency_ms": e.latency_ms,
                    "endpoint": e.endpoint
                }
                for e in entries
            ]

    def clear(self):
        """Clear all usage data."""
        with self._lock:
            self._entries.clear()
            self._total_prompt_tokens = 0
            self._total_completion_tokens = 0
            self._total_requests = 0
            self._start_time = time.time()


# Global usage tracker instance
usage_tracker = UsageTracker()
