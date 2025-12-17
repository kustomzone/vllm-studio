from vllmstudio.http_proxy import ProxiedResponse
import vllmstudio.api as api_module

from fastapi.testclient import TestClient


def test_anthropic_messages_passthrough(monkeypatch):
    async def fake_post_streaming(*_args, **_kwargs):
        return ProxiedResponse(
            status_code=200,
            headers={"content-type": "application/json"},
            content_type="application/json",
            body=b'{"id":"msg_1","type":"message"}',
        )

    monkeypatch.setattr(api_module, "post_streaming", fake_post_streaming)

    client = TestClient(api_module.app)
    r = client.post(
        "/v1/messages",
        headers={"Authorization": f"Bearer {api_module.settings.api_key}"},
        json={"model": "x", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 200
    assert r.json()["id"] == "msg_1"

