def test_leaderboard(client):
    num_users = 10

    for i in range(1, num_users):
        register_payload = {
            "email": f"user-{i}@example.com",
            "password": "password123",
            "displayName": f"User {i}",
        }
        reg_resp = client.post("/auth/register", json=register_payload)
        assert reg_resp.status_code == 201

    resp1 = client.get(f"/users/leaderboard?limit=1")
    assert resp1.status_code == 200

    data1 = resp1.json()
    assert "leaderboard" in data1
    assert len(data1["leaderboard"]) == 1

    resp2 = client.get(f"/users/leaderboard?limit={num_users}")
    assert resp2.status_code == 200

    data2 = resp2.json()
    assert "leaderboard" in data2
    assert len(data2["leaderboard"]) == num_users

    resp3 = client.get(f"/users/leaderboard?limit={2 * num_users}")
    assert resp3.status_code == 200

    data3 = resp3.json()
    assert "leaderboard" in data3
    assert len(data3["leaderboard"]) == num_users


def test_leaderboard_invalid(client):
    resp1 = client.get(f"/users/leaderboard?limit=0")
    assert resp1.status_code == 422

    resp2 = client.get(f"/users/leaderboard?limit=0.5")
    assert resp2.status_code == 422

    resp3 = client.get(f"/users/leaderboard?limit=-1")
    assert resp3.status_code == 422
