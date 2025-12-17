from pathlib import Path

from fastapi.testclient import TestClient

import vllmstudio.api as api_module
from vllmstudio.models import Recipe
from vllmstudio.recipe_manager import RecipeManager


def test_recipe_launch_plan_endpoint(monkeypatch, tmp_path: Path):
    manager = RecipeManager(recipes_dir=tmp_path)
    recipe = Recipe(id="r1", name="R1", model_path="/mnt/llm_models/Test", backend="vllm")
    manager.save_recipe(recipe)

    monkeypatch.setattr(api_module, "recipe_manager", manager)

    # Avoid calling into the real ProcessManager on the host
    class DummyBackend:
        name = "vllm"

        def build_launch_command(self, _recipe):
            return ["vllm", "serve", _recipe.model_path]

        def build_launch_env(self, _recipe):
            return {}

        def default_log_file(self, recipe_id: str):
            return Path(f"/tmp/vllm_{recipe_id}.log")

    monkeypatch.setattr(api_module, "get_backend", lambda _backend: DummyBackend())

    client = TestClient(api_module.app)
    r = client.get(
        "/recipes/r1/plan",
        headers={"Authorization": f"Bearer {api_module.settings.api_key}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["backend"] == "vllm"
    assert data["command"][0] == "vllm"
    assert data["log_file"].endswith("/tmp/vllm_r1.log")
