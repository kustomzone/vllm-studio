from __future__ import annotations

from pathlib import Path

from vllmstudio.models import Recipe, Backend
from vllmstudio.process_manager import ProcessManager


def test_recipe_accepts_engine_and_folds_unknown_keys_into_extra_args():
    recipe = Recipe(
        id="test",
        name="Test",
        model_path="/mnt/llm_models/Test",
        engine="vllm",
        enforce_eager=False,
        limit_mm_per_prompt={"image": 4, "video": 1},
        description="meta",
        tags=["a", "b"],
    )

    assert recipe.backend == Backend.VLLM
    assert recipe.description == "meta"
    assert recipe.tags == ["a", "b"]
    assert recipe.extra_args["enforce_eager"] is False
    assert recipe.extra_args["limit_mm_per_prompt"] == {"image": 4, "video": 1}


def test_process_manager_normalizes_extra_args_flags_and_json_values(tmp_path: Path):
    venv = tmp_path / "venv"
    (venv / "bin").mkdir(parents=True)
    python_exe = venv / "bin" / "python"
    python_exe.write_text("#!/bin/sh\nexit 0\n")

    recipe = Recipe(
        id="test",
        name="Test",
        model_path="/mnt/llm_models/Test",
        backend="vllm",
        venv_path=str(venv),
        host="0.0.0.0",
        port=8000,
        extra_args={
            "enforce_eager": True,
            "limit_mm_per_prompt": {"image": 4, "video": 1},
        },
    )

    cmd = ProcessManager.build_launch_command(recipe)

    # Uses venv python
    assert cmd[0] == str(python_exe)
    # Normalizes underscores to hyphens
    assert "--enforce-eager" in cmd
    # JSON-encodes dict values
    idx = cmd.index("--limit-mm-per-prompt")
    assert cmd[idx + 1] == '{"image": 4, "video": 1}'

