from fastapi.testclient import TestClient

from controller.app import app


def test_health_endpoint_returns_status() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert "status" in response.json()
