from app.main import check_database


def test_health_responde_en_camel_case(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert "serverTime" in body
    assert "server_time" not in body


def test_health_avisa_si_la_base_no_responde(app, client):
    app.dependency_overrides[check_database] = lambda: False
    assert client.get("/health").json()["database"] == "unavailable"


def test_cors_permite_el_front(client):
    response = client.options(
        "/health",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"
