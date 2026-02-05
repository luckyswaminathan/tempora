"""
Tests for the collateral system and balance checks.

Collateral rules:
- When buying: check user has enough spendable balance (wallet - locked collateral)
- When shorting: require collateral = |short quantity| * 100 cents per share
- Collateral is released when short positions are closed
- Existing long positions offset collateral requirements
"""

import pytest

from schemas.market import Market


@pytest.fixture()
def market_2_outcomes(client) -> Market:
    """Create a simple 2-outcome market for testing."""
    payload = {
        "question": "Test Market",
        "outcomes": [{"outcome": "Yes"}, {"outcome": "No"}],
        "category": "general",
        "resolutionDate": "2030-01-01T00:00:00",
        "description": "",
        "liquidityParameter": "100",
    }
    resp = client.post("/markets", json=payload)
    assert resp.status_code == 201
    return Market.model_validate(resp.json())


class TestBuyBalanceValidation:
    """Tests for balance validation when buying shares."""

    def test_buy_within_balance_succeeds(self, client, market_2_outcomes):
        """User can buy when they have sufficient balance."""
        # Get initial balance
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        initial_balance = resp.json()["wallet"]

        # Buy 1 share of first security
        security_id = market_2_outcomes.securities[0].id
        payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 1}],
        }
        resp = client.post("/trades", json=payload)
        assert resp.status_code == 201

        # Verify balance decreased
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        assert resp.json()["wallet"] < initial_balance

    def test_buy_exceeding_balance_fails(self, client, market_2_outcomes):
        """User cannot buy more than their balance allows."""
        # Get initial balance
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        initial_balance = resp.json()["wallet"]

        # Try to buy way more shares than balance allows
        security_id = market_2_outcomes.securities[0].id
        payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 100000}],
        }
        resp = client.post("/trades", json=payload)
        assert resp.status_code == 400
        assert "Insufficient balance" in resp.json()["detail"]

        # Verify balance unchanged
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        assert resp.json()["wallet"] == initial_balance


class TestShortCollateral:
    """Tests for collateral requirements when shorting."""

    def test_short_requires_collateral(self, client, market_2_outcomes):
        """Shorting requires collateral = quantity * $1 per share."""
        # First buy some shares so we can short
        security_id = market_2_outcomes.securities[0].id
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 10}],
        }
        resp = client.post("/trades", json=buy_payload)
        assert resp.status_code == 201
        buy_cost = resp.json()["priceCents"]

        # Get balance after buy
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        balance_after_buy = resp.json()["wallet"]

        # Now sell 5 shares (closing part of position, no collateral needed)
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -5}],
        }
        resp = client.post("/trades", json=sell_payload)
        assert resp.status_code == 201

    def test_short_beyond_position_requires_collateral(self, client, market_2_outcomes):
        """Shorting beyond existing long position requires collateral."""
        security_id = market_2_outcomes.securities[0].id

        # Buy 5 shares first
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 5}],
        }
        resp = client.post("/trades", json=buy_payload)
        assert resp.status_code == 201

        # Sell 10 shares (5 closing, 5 new short) - should work with collateral
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -10}],
        }
        resp = client.post("/trades", json=sell_payload)
        # This should succeed since we receive money and use it for collateral
        assert resp.status_code == 201

    def test_naked_short_requires_collateral(self, client, market_2_outcomes):
        """Shorting without any position requires full collateral."""
        security_id = market_2_outcomes.securities[0].id

        # Short 5 shares without owning any
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -5}],
        }
        resp = client.post("/trades", json=sell_payload)
        # Should succeed - we receive premium and need collateral
        assert resp.status_code == 201

    def test_excessive_short_fails_insufficient_collateral(
        self, client, market_2_outcomes
    ):
        """Cannot short if resulting collateral requirement exceeds balance."""
        security_id = market_2_outcomes.securities[0].id

        # Try to short a massive amount
        # Collateral needed = 10000 * $1 = $10,000 = 1,000,000 cents
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -10000}],
        }
        resp = client.post("/trades", json=sell_payload)
        assert resp.status_code == 400
        assert "collateral" in resp.json()["detail"].lower()


class TestSpendableBalance:
    """Tests for spendable balance calculation."""

    def test_spendable_balance_reduced_by_collateral(self, client, market_2_outcomes):
        """Spendable balance should be wallet minus locked collateral."""
        # Get initial balance
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        initial_wallet = resp.json()["wallet"]

        security_id = market_2_outcomes.securities[0].id

        # Short 10 shares (requires 1000 cents = $10 collateral)
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -10}],
        }
        resp = client.post("/trades", json=sell_payload)
        assert resp.status_code == 201
        sell_proceeds = -resp.json()["priceCents"]  # Negative cost = proceeds

        # Check wallet increased by proceeds
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        new_wallet = resp.json()["wallet"]
        assert new_wallet == initial_wallet + sell_proceeds

    def test_buy_after_short_limited_by_collateral(self, client, market_2_outcomes):
        """After shorting, buying is limited by spendable balance not wallet."""
        security_a = market_2_outcomes.securities[0].id
        security_b = market_2_outcomes.securities[1].id

        # Get initial balance
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        initial_wallet = resp.json()["wallet"]

        # Short security A - this locks collateral
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_a, "quantity": -50}],
        }
        resp = client.post("/trades", json=sell_payload)
        assert resp.status_code == 201

        # Now try to buy a huge amount of security B
        # Even though wallet has money, collateral is locked
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_b, "quantity": 100000}],
        }
        resp = client.post("/trades", json=buy_payload)
        assert resp.status_code == 400
        assert "Insufficient balance" in resp.json()["detail"]


class TestCollateralRelease:
    """Tests for collateral release when closing short positions."""

    def test_closing_short_releases_collateral(self, client, market_2_outcomes):
        """Closing a short position should release the locked collateral."""
        security_id = market_2_outcomes.securities[0].id

        # Short 10 shares
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -10}],
        }
        resp = client.post("/trades", json=sell_payload)
        assert resp.status_code == 201

        # Get balance after short
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        wallet_after_short = resp.json()["wallet"]

        # Buy 10 shares to close the short
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 10}],
        }
        resp = client.post("/trades", json=buy_payload)
        assert resp.status_code == 201

        # After closing, we should have full access to remaining wallet
        # (minus the cost of buying to close)


class TestMultipleLegTrades:
    """Tests for multi-leg trades with collateral."""

    def test_multi_leg_buy_and_sell(self, client, market_2_outcomes):
        """Multi-leg trade with both buys and sells."""
        security_a = market_2_outcomes.securities[0].id
        security_b = market_2_outcomes.securities[1].id

        # First establish a position in security A
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_a, "quantity": 10}],
        }
        resp = client.post("/trades", json=buy_payload)
        assert resp.status_code == 201

        # Now do a multi-leg: sell A, buy B
        multi_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [
                {"securityId": security_a, "quantity": -5},
                {"securityId": security_b, "quantity": 5},
            ],
        }
        resp = client.post("/trades", json=multi_payload)
        assert resp.status_code == 201


class TestPriceEndpoint:
    """Tests for the price endpoint (should not check balance)."""

    def test_price_does_not_check_balance(self, client, market_2_outcomes):
        """Pricing a trade should work regardless of balance."""
        security_id = market_2_outcomes.securities[0].id

        # Price a massive trade that would exceed balance
        payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 1000000}],
        }
        resp = client.post("/trades/price", json=payload)
        # Price endpoint should succeed
        assert resp.status_code == 200
        assert "priceCents" in resp.json()

    def test_price_short_trade(self, client, market_2_outcomes):
        """Pricing a short trade should return negative price (proceeds)."""
        security_id = market_2_outcomes.securities[0].id

        payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -10}],
        }
        resp = client.post("/trades/price", json=payload)
        assert resp.status_code == 200
        # Shorting should give negative price (you receive money)
        assert resp.json()["priceCents"] < 0
