from vllmstudio.backends import get_backend
from vllmstudio.models import Backend


def test_backend_registry_resolves_defaults():
    assert get_backend(Backend.VLLM).name == "vllm"
    assert get_backend(Backend.SGLANG).name == "sglang"

