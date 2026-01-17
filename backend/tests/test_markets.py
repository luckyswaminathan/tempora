def test_list_markets(client):
    resp = client.get("/markets")
    assert resp.status_code == 200
    assert "items" in resp.json()
    assert "count" in resp.json()


def test_create_market(client):
    payload = {
        "question": "When will Bitcoin hit $100k?",
        "outcomes": ["2025", "2026", "2027", "2028"],
        "category": "crypto",
        "resolutionDate": "2030-01-01T00:00:00",
        "description": "Example",
    }

    resp = client.post("/markets", json=payload)
    print(resp.json())
    assert resp.status_code == 201

    data = resp.json()
    assert data["question"] == payload["question"]
    assert data["category"] == payload["category"]
    assert data["resolutionDate"] == payload["resolutionDate"]
    assert data["description"] == payload["description"]

    assert len(data["quotes"]) == len(payload["outcomes"])
    for quote in data["quotes"]:
        assert quote["impliedProbability"] == 1.0 / len(payload["outcomes"])
