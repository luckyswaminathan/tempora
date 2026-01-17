import pytest


@pytest.mark.parametrize("test_market", [4, 8, 16, 32], indirect=True)
def test_price_trade(client, test_market):
    outcomes = len(test_market.securities)

    for security in test_market.securities:
        payload = {
            "marketId": test_market.id,
            "legs": [{"securityId": security.id, "quantity": 1}],
        }
        resp = client.post("/trades/price", json=payload)
        assert resp.status_code == 200

        data = resp.json()
        assert abs(data["priceCents"] - 100 / outcomes) <= 0.5


@pytest.mark.parametrize("test_market", [4, 8, 16], indirect=True)
def test_place_trade(client, test_market):
    outcomes = len(test_market.securities)

    resp = client.get("/users/me/profile")
    assert resp.status_code == 200

    data = resp.json()
    wallet = data["wallet"]

    for security in test_market.securities:
        payload = {
            "marketId": test_market.id,
            "legs": [{"securityId": security.id, "quantity": 1}],
        }
        resp = client.post("/trades", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert abs(data["priceCents"] - 100 / outcomes) <= 0.5
        wallet -= data["priceCents"]

        resp = client.get("/users/me/profile")
        assert resp.status_code == 200

        data = resp.json()
        assert data["wallet"] == wallet
