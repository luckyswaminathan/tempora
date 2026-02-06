"""
Tests for trading functionality and LMSR pricing.

SCOPE: These tests verify the trading MECHANISM itself - the core functionality
of executing trades, calculating prices, and updating balances.

What this tests:
- LMSR price calculation algorithm
- Trade execution API (/trades and /trades/price endpoints)
- Wallet balance updates during trades
- Trade transaction mechanics

What this does NOT test:
- Settlement/resolution of markets - see test_settlement.py
- Market creation - see test_proposals.py
- Position tracking after settlement

NOTE: Settlement tests (test_settlement.py) use trading as a SETUP step to create
positions before testing settlement logic. They assume trading works correctly.
"""

import pytest


@pytest.mark.parametrize("trade_market", [4, 8, 16, 32], indirect=True)
def test_price_trade(trader_client, trade_market):
    """Test LMSR price calculation for trades."""
    outcomes = len(trade_market.securities)

    for security in trade_market.securities:
        payload = {
            "marketId": trade_market.id,
            "legs": [{"securityId": security.id, "quantity": 1}],
        }
        resp = trader_client.post("/trades/price", json=payload)
        assert resp.status_code == 200

        data = resp.json()
        assert abs(data["priceCents"] - 100 / outcomes) <= 0.5


@pytest.mark.parametrize("trade_market", [4, 8, 16], indirect=True)
def test_place_trade(trader_client, trade_market):
    """Test trade execution and wallet balance tracking."""
    outcomes = len(trade_market.securities)

    resp = trader_client.get("/users/me/profile")
    assert resp.status_code == 200

    data = resp.json()
    wallet = data["wallet"]

    for security in trade_market.securities:
        payload = {
            "marketId": trade_market.id,
            "legs": [{"securityId": security.id, "quantity": 1}],
        }
        resp = trader_client.post("/trades", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert abs(data["priceCents"] - 100 / outcomes) <= 0.5
        wallet -= data["priceCents"]

        resp = trader_client.get("/users/me/profile")
        assert resp.status_code == 200

        data = resp.json()
        assert data["wallet"] == wallet


def test_sell_trade(trader_client, trade_market):
    """Test selling shares reduces position and credits wallet."""
    # First buy some shares
    security_id = trade_market.securities[0].id
    buy_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/trades", json=buy_payload)
    assert resp.status_code == 201
    buy_cost = resp.json()["priceCents"]

    # Get wallet after buy
    resp = trader_client.get("/users/me/profile")
    wallet_after_buy = resp.json()["wallet"]

    # Sell 5 shares
    sell_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": -5}],
    }
    resp = trader_client.post("/trades", json=sell_payload)
    assert resp.status_code == 201
    sell_price = resp.json()["priceCents"]

    # Selling should credit the wallet (negative price)
    assert sell_price < 0

    # Verify wallet increased by sell proceeds
    resp = trader_client.get("/users/me/profile")
    wallet_after_sell = resp.json()["wallet"]
    assert wallet_after_sell == wallet_after_buy - sell_price


def test_multi_leg_trade(trader_client, trade_market):
    """Test bundle trades with multiple legs execute atomically."""
    outcomes = len(trade_market.securities)

    # Get initial wallet
    resp = trader_client.get("/users/me/profile")
    initial_wallet = resp.json()["wallet"]

    # Buy 1 share of each outcome (creates a complete set)
    legs = [
        {"securityId": security.id, "quantity": 1}
        for security in trade_market.securities
    ]
    payload = {"marketId": trade_market.id, "legs": legs}

    resp = trader_client.post("/trades", json=payload)
    assert resp.status_code == 201
    cost = resp.json()["priceCents"]

    # Cost of complete set should be close to $1 (100 cents)
    assert abs(cost - 100) < 5  # Allow small deviation for liquidity parameter

    # Verify wallet decreased
    resp = trader_client.get("/users/me/profile")
    assert resp.json()["wallet"] == initial_wallet - cost


def test_price_impact(trader_client, trade_market):
    """Test that successive buys increase price (LMSR market impact)."""
    security_id = trade_market.securities[0].id

    # Price first trade
    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/trades/price", json=payload)
    first_price = resp.json()["priceCents"]

    # Execute first trade
    resp = trader_client.post("/trades", json=payload)
    assert resp.status_code == 201

    # Price second identical trade
    resp = trader_client.post("/trades/price", json=payload)
    second_price = resp.json()["priceCents"]

    # Second trade should be more expensive (price impact)
    assert second_price > first_price


def test_round_trip_trade(trader_client, trade_market):
    """Test buy then sell round trip returns to initial state in pure LMSR."""
    security_id = trade_market.securities[0].id

    # Get initial wallet
    resp = trader_client.get("/users/me/profile")
    initial_wallet = resp.json()["wallet"]

    # Buy 10 shares
    buy_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/trades", json=buy_payload)
    buy_cost = resp.json()["priceCents"]

    # Immediately sell same 10 shares
    sell_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": -10}],
    }
    resp = trader_client.post("/trades", json=sell_payload)
    sell_proceeds = -resp.json()["priceCents"]  # Negative cost = proceeds

    # Final wallet
    resp = trader_client.get("/users/me/profile")
    final_wallet = resp.json()["wallet"]

    # In pure LMSR, round-trip returns to same state with no net loss
    net_loss = initial_wallet - final_wallet
    assert abs(net_loss) <= 1  # Allow for rounding errors (within 1 cent)
    assert abs(buy_cost - sell_proceeds) <= 1


def test_invalid_market_id(trader_client, trade_market):
    """Test trade with invalid market ID fails gracefully."""
    payload = {
        "marketId": "invalid-market-id",
        "legs": [{"securityId": trade_market.securities[0].id, "quantity": 1}],
    }
    resp = trader_client.post("/trades", json=payload)
    assert resp.status_code == 400


def test_invalid_security_id(trader_client, trade_market):
    """Test trade with invalid security ID fails gracefully."""
    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": "invalid-security-id", "quantity": 1}],
    }
    resp = trader_client.post("/trades", json=payload)
    assert resp.status_code == 404


def test_zero_quantity_trade(trader_client, trade_market):
    """Test trade with zero quantity is a no-op trade (costs nothing)."""
    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": trade_market.securities[0].id, "quantity": 0}],
    }
    resp = trader_client.post("/trades", json=payload)
    assert resp.status_code == 201
    # Zero quantity trade should cost nothing
    assert resp.json()["priceCents"] == 0


def test_mixed_buy_sell_trade(trader_client, trade_market):
    """Test multi-leg trade with both buys and sells."""
    # First establish positions
    for i in range(2):
        payload = {
            "marketId": trade_market.id,
            "legs": [{"securityId": trade_market.securities[i].id, "quantity": 10}],
        }
        trader_client.post("/trades", json=payload)

    # Get wallet before mixed trade
    resp = trader_client.get("/users/me/profile")
    wallet_before = resp.json()["wallet"]

    # Buy security 2, sell security 0
    mixed_payload = {
        "marketId": trade_market.id,
        "legs": [
            {"securityId": trade_market.securities[0].id, "quantity": -5},  # Sell
            {"securityId": trade_market.securities[2].id, "quantity": 5},  # Buy
        ],
    }
    resp = trader_client.post("/trades", json=mixed_payload)
    assert resp.status_code == 201
    net_cost = resp.json()["priceCents"]

    # Verify wallet changed by net cost
    resp = trader_client.get("/users/me/profile")
    assert resp.json()["wallet"] == wallet_before - net_cost


def test_trade_list_endpoint(trader_client, trade_market):
    """Test retrieving trade history."""
    # Execute a few trades
    for i in range(3):
        payload = {
            "marketId": trade_market.id,
            "legs": [{"securityId": trade_market.securities[i].id, "quantity": 1}],
        }
        trader_client.post("/trades", json=payload)

    # Get trade list
    resp = trader_client.get("/trades")
    assert resp.status_code == 200

    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 3  # At least our 3 trades


def test_large_quantity_trade(trader_client, trade_market):
    """Test trade with large quantity succeeds if balance sufficient."""
    security_id = trade_market.securities[0].id

    # Price a large trade
    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 100}],
    }
    resp = trader_client.post("/trades/price", json=payload)
    assert resp.status_code == 200
    price = resp.json()["priceCents"]

    # Get wallet
    resp = trader_client.get("/users/me/profile")
    wallet = resp.json()["wallet"]

    # Execute if balance sufficient
    if price <= wallet:
        resp = trader_client.post("/trades", json=payload)
        assert resp.status_code == 201
    else:
        resp = trader_client.post("/trades", json=payload)
        assert resp.status_code == 400


def test_probability_converges_with_trades(trader_client, trade_market):
    """Test that buying shifts probability toward that outcome."""
    # In a 4-outcome market, initial probability should be ~25% each
    outcomes = len(trade_market.securities)
    expected_initial_prob = 1.0 / outcomes

    # Buy significant quantity of first security
    security_id = trade_market.securities[0].id
    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 50}],
    }
    resp = trader_client.post("/trades", json=payload)
    assert resp.status_code == 201

    # Get updated market data
    resp = trader_client.get(f"/markets/{trade_market.id}")
    market_data = resp.json()

    # Find the security we bought
    bought_security = next(
        q for q in market_data["quotes"] if q["securityId"] == security_id
    )

    # Probability should have increased from initial (with high liquidity, ~1% increase)
    assert bought_security["impliedProbability"] > expected_initial_prob + 0.009
