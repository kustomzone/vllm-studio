from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from vllmstudio.models import Recipe
from vllmstudio_controller.app import create_app
from vllmstudio_controller.config import Settings


def test_controller_swagger_and_recipes(tmp_path: Path):
    cfg = Settings(
        api_key="k",
        sqlite_path=tmp_path / "db.sqlite",
        inference_port=65534,
        enable_anthropic_passthrough=False,
    )
    app = create_app(cfg)
    client = TestClient(app)

    assert client.get("/openapi.json").status_code == 200

    # Auth required for recipes
    assert client.get("/recipes").status_code == 401

    headers = {"Authorization": "Bearer k"}
    recipe = Recipe(id="r1", name="R1", model_path="/mnt/llm_models/Test", backend="vllm")

    r = client.post("/recipes", headers=headers, json=recipe.model_dump())
    assert r.status_code == 200

    r = client.get("/recipes", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = client.get("/recipes/r1/plan", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["recipe"]["id"] == "r1"
    assert data["backend"] == "vllm"
