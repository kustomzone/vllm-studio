"""Process inspection (minimal)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import psutil


@dataclass(frozen=True)
class ProcessInfoLite:
    pid: int
    cmdline: List[str]
    port: int
    model_path: Optional[str] = None
    backend: Optional[str] = None


def _extract_port(cmdline: List[str]) -> Optional[int]:
    for i, arg in enumerate(cmdline):
        if arg == "--port" and i + 1 < len(cmdline):
            try:
                return int(cmdline[i + 1])
            except ValueError:
                return None
    return None


def _is_vllm_process(cmdline: List[str]) -> bool:
    if not cmdline:
        return False
    joined = " ".join(cmdline)
    if "vllm.entrypoints.openai.api_server" in joined:
        return True
    # vLLM CLI form: `vllm serve <model> ...`
    if len(cmdline) >= 2 and cmdline[0].endswith("vllm") and cmdline[1] == "serve":
        return True
    return False


def _is_sglang_process(cmdline: List[str]) -> bool:
    if not cmdline:
        return False
    joined = " ".join(cmdline)
    return "sglang.launch_server" in joined


def find_current_inference_process(port: int) -> Optional[ProcessInfoLite]:
    for proc in psutil.process_iter(["pid", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline") or []
            if not cmdline:
                continue
            if not (_is_vllm_process(cmdline) or _is_sglang_process(cmdline)):
                continue

            p = _extract_port(cmdline)
            if p is None or p != port:
                continue

            backend = "sglang" if _is_sglang_process(cmdline) else "vllm"
            return ProcessInfoLite(
                pid=int(proc.info["pid"]),
                cmdline=list(cmdline),
                port=p,
                backend=backend,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None
