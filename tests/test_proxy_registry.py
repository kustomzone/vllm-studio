from proxy.config import Settings
from proxy.registry import AdapterKind, AdapterRegistry, AdapterSpec, register_default_adapters


def test_adapter_registry_matches_case_insensitive():
    registry = AdapterRegistry()
    registry.register(AdapterSpec(name="minimax", kind=AdapterKind.MINIMAX, patterns=["MiniMax"]))

    adapter = registry.match("minimax-m2-awq")
    assert adapter is not None
    assert adapter.kind == AdapterKind.MINIMAX
    assert adapter.name == "minimax"


def test_default_adapter_registration_respects_settings():
    registry = AdapterRegistry()
    settings = Settings(
        minimax_model_patterns=["foo-model"],
        glm_model_patterns=["glm4"],
        mistral_model_patterns=["devstral"],
        minimax_venv="/opt/venvs/minimax",
    )

    register_default_adapters(registry, settings)
    names = [a.name for a in registry.list()]
    assert "minimax" in names and "glm" in names and "mistral" in names

    adapter = registry.match("foo-model-123")
    assert adapter is not None
    assert adapter.venv_path == "/opt/venvs/minimax"
    assert adapter.kind == AdapterKind.MINIMAX
