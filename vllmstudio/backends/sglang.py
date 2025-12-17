"""SGLang backend implementation."""

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


class SGLangBackend(InferenceBackend):
    name = "sglang"

    def build_launch_command(self, recipe: Recipe) -> list[str]:
        python_exe = recipe.python_path or _python_from_venv(getattr(recipe, "venv_path", None))
        sglang_python = python_exe or "/opt/venvs/frozen/sglang-prod/bin/python"

        cmd = [sglang_python, "-m", "sglang.launch_server"]
        cmd.extend(["--model-path", recipe.model_path])
        cmd.extend(["--host", recipe.host, "--port", str(recipe.port)])

        if recipe.tensor_parallel_size > 1:
            cmd.extend(["--tp", str(recipe.tensor_parallel_size)])

        cmd.extend(["--context-length", str(recipe.max_model_len)])
        cmd.extend(["--mem-fraction-static", str(recipe.gpu_memory_utilization)])

        if recipe.trust_remote_code:
            cmd.append("--trust-remote-code")

        for key, value in recipe.extra_args.items():
            if key is None:
                continue
            key_str = str(key).lstrip("-").replace("_", "-")
            flag = f"--{key_str}"
            if value is True:
                cmd.append(flag)
            elif value is not False and value is not None:
                if isinstance(value, (dict, list)):
                    cmd.extend([flag, json.dumps(value)])
                else:
                    cmd.extend([flag, str(value)])

        return cmd

