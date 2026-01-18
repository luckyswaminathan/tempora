def test_profile(client):
    payload = {"displayName": None}
    resp = client.post("/auth/sync-profile", json=payload)
    assert resp.status_code == 200

    resp = client.get("/users/me/profile")
    assert resp.status_code == 200

    data = resp.json()
    assert "id" in data
    assert "email" in data
    assert "role" in data
    assert "displayName" in data
    assert "wallet" in data
    assert "joinedAt" in data
    assert "lastSeenAt" in data


def test_portfolio(client):
    # TODO
    pass
