def test_auth_me(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 200

    data = resp.json()
    assert "id" in data
    assert "email" in data
