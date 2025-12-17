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


def _extract_port(cmdline: List[str], default: int) -> int:
    for i, arg in enumerate(cmdline):
        if arg == "--port" and i + 1 < len(cmdline):
            try:
                return int(cmdline[i + 1])
            except ValueError:
                return default
    return default


def find_current_inference_process(port: int) -> Optional[ProcessInfoLite]:
    for proc in psutil.process_iter(["pid", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline") or []
            if not cmdline:
                continue
            cmd_str = " ".join(cmdline).lower()
            if "vllm" in cmd_str or "sglang" in cmd_str:
                p = _extract_port(cmdline, default=8000)
                if p == port:
                    return ProcessInfoLite(
                        pid=int(proc.info["pid"]),
                        cmdline=list(cmdline),
                        port=p,
                    )
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None

