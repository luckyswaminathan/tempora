def test_auth_me(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 200

    data = resp.json()
    assert "id" in data
    assert "email" in data


def test_register_and_login_flow():
    from main import create_app
    from fastapi.testclient import TestClient

    app = create_app()
    with TestClient(app) as live_client:
        register_payload = {
            "email": "new-user@example.com",
            "password": "password123",
            "displayName": "New User",
        }
        reg_resp = live_client.post("/auth/register", json=register_payload)
        assert reg_resp.status_code == 201
        tokens = reg_resp.json()["tokens"]

        login_resp = live_client.post(
            "/auth/login",
            json={
                "email": register_payload["email"],
                "password": register_payload["password"],
            },
        )
        assert login_resp.status_code == 200
        login_tokens = login_resp.json()["tokens"]

        me_resp = live_client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {tokens['accessToken']}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == register_payload["email"]

        me_resp_login = live_client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {login_tokens['accessToken']}"},
        )
        assert me_resp_login.status_code == 200
