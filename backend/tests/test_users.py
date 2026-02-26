import pytest
from conftest import create_position


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


class TestPortfolioEmpty:
    """Portfolio for a user with no trades."""

    def test_portfolio_empty_structure(self, client):
        resp = client.get("/users/me/portfolio")
        assert resp.status_code == 200
        data = resp.json()

        assert "wallet" in data
        assert "spendableBalance" in data
        assert "collateralLocked" in data
        assert "holdings" in data
        assert "summary" in data
        assert data["holdings"] == []

    def test_portfolio_empty_summary_zeroed(self, client):
        resp = client.get("/users/me/portfolio")
        data = resp.json()
        summary = data["summary"]

        assert summary["costBasis"] == 0
        assert summary["marketValue"] == 0
        assert summary["unrealisedPnL"] == 0
        assert summary["roi"] == 0.0
        assert summary["avgProbability"] == 0.0

    def test_portfolio_empty_spendable_equals_wallet(self, client):
        resp = client.get("/users/me/portfolio")
        data = resp.json()
        assert data["spendableBalance"] == data["wallet"]
        assert data["collateralLocked"] == 0


@pytest.mark.parametrize("trade_market", [4], indirect=True)
class TestPortfolioAfterBuy:
    """Portfolio after placing a single market buy order."""

    def test_holding_appears(self, trader_client, trade_market):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 5)

        resp = trader_client.get("/users/me/portfolio")
        assert resp.status_code == 200
        holdings = resp.json()["holdings"]

        assert len(holdings) == 1
        h = holdings[0]
        assert h["marketId"] == trade_market.id
        assert h["securityId"] == security.id
        assert h["quantity"] == 5

    def test_holding_fields_populated(self, trader_client, trade_market):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 3)

        resp = trader_client.get("/users/me/portfolio")
        h = resp.json()["holdings"][0]

        assert h["question"] == trade_market.question
        assert h["outcome"] == security.outcome
        assert h["category"] == trade_market.category
        assert isinstance(h["avgPriceCents"], float)
        assert isinstance(h["markPriceCents"], float)
        assert isinstance(h["pnl"], (int, float))
        assert "endDate" in h

    def test_summary_cost_basis_matches_trade_cost(self, trader_client, trade_market):
        security = trade_market.securities[0]
        trade = create_position(trader_client, trade_market.id, security.id, 10)
        cost = trade["priceCents"]

        resp = trader_client.get("/users/me/portfolio")
        summary = resp.json()["summary"]

        assert summary["costBasis"] == pytest.approx(cost, abs=1)

    def test_summary_roi_formula(self, trader_client, trade_market):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 10)

        resp = trader_client.get("/users/me/portfolio")
        summary = resp.json()["summary"]

        if summary["costBasis"] > 0:
            expected_roi = summary["unrealisedPnL"] / summary["costBasis"] * 100
            assert summary["roi"] == pytest.approx(expected_roi, abs=0.1)

    def test_summary_pnl_equals_market_value_minus_cost(
        self, trader_client, trade_market
    ):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 10)

        resp = trader_client.get("/users/me/portfolio")
        summary = resp.json()["summary"]

        expected_pnl = summary["marketValue"] - summary["costBasis"]
        assert summary["unrealisedPnL"] == pytest.approx(expected_pnl, abs=1)

    def test_wallet_debited_after_buy(self, trader_client, trade_market):
        resp = trader_client.get("/users/me/profile")
        wallet_before = resp.json()["wallet"]

        security = trade_market.securities[0]
        trade = create_position(trader_client, trade_market.id, security.id, 5)
        cost = trade["priceCents"]

        resp = trader_client.get("/users/me/portfolio")
        portfolio_wallet = resp.json()["wallet"]

        assert portfolio_wallet == pytest.approx(wallet_before - cost, abs=1)


@pytest.mark.parametrize("trade_market", [4], indirect=True)
class TestPortfolioQuantityTracking:
    """Buying more, partial sells, and full sells."""

    def test_partial_sell_reduces_quantity(self, trader_client, trade_market):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 10)
        create_position(trader_client, trade_market.id, security.id, -4)

        resp = trader_client.get("/users/me/portfolio")
        holdings = resp.json()["holdings"]

        assert len(holdings) == 1
        assert holdings[0]["quantity"] == 6

    def test_full_sell_removes_holding(self, trader_client, trade_market):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 10)
        create_position(trader_client, trade_market.id, security.id, -10)

        resp = trader_client.get("/users/me/portfolio")
        holdings = resp.json()["holdings"]

        assert holdings == []

    def test_accumulate_buys_same_security(self, trader_client, trade_market):
        security = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security.id, 5)
        create_position(trader_client, trade_market.id, security.id, 3)

        resp = trader_client.get("/users/me/portfolio")
        holdings = resp.json()["holdings"]

        assert len(holdings) == 1
        assert holdings[0]["quantity"] == 8


@pytest.mark.parametrize("trade_market", [4], indirect=True)
class TestPortfolioMultipleMarkets:
    """Portfolio with holdings spanning multiple markets."""

    def test_holdings_from_two_markets(
        self,
        trader_client,
        trader_user,
        market_maker_client,
        admin_client,
        trade_market,
        db_session,
    ):
        from conftest import create_and_publish_market

        # Position in the fixture market
        security_a = trade_market.securities[0]
        create_position(trader_client, trade_market.id, security_a.id, 5)

        # Create and publish a second market, then take a position
        market_b = create_and_publish_market(
            market_maker_client, admin_client, outcomes=["Yes", "No"]
        )
        security_b = market_b.securities[0]
        create_position(trader_client, market_b.id, security_b.id, 3)

        resp = trader_client.get("/users/me/portfolio")
        holdings = resp.json()["holdings"]
        market_ids = {h["marketId"] for h in holdings}

        assert trade_market.id in market_ids
        assert market_b.id in market_ids

    def test_summary_aggregates_across_markets(
        self,
        trader_client,
        market_maker_client,
        admin_client,
        trade_market,
    ):
        from conftest import create_and_publish_market

        t1 = create_position(
            trader_client, trade_market.id, trade_market.securities[0].id, 5
        )
        market_b = create_and_publish_market(
            market_maker_client, admin_client, outcomes=["Yes", "No"]
        )
        t2 = create_position(trader_client, market_b.id, market_b.securities[0].id, 3)

        resp = trader_client.get("/users/me/portfolio")
        summary = resp.json()["summary"]

        assert summary["costBasis"] == pytest.approx(
            t1["priceCents"] + t2["priceCents"], abs=2
        )

    def test_avg_probability_between_0_and_100(
        self,
        trader_client,
        market_maker_client,
        admin_client,
        trade_market,
    ):
        from conftest import create_and_publish_market

        create_position(
            trader_client, trade_market.id, trade_market.securities[0].id, 5
        )
        market_b = create_and_publish_market(
            market_maker_client, admin_client, outcomes=["Yes", "No"]
        )
        create_position(trader_client, market_b.id, market_b.securities[0].id, 3)

        resp = trader_client.get("/users/me/portfolio")
        avg_prob = resp.json()["summary"]["avgProbability"]

        assert 0.0 <= avg_prob <= 100.0


class TestPortfolioResolvedMarketExclusion:
    """Resolved markets must not appear in portfolio holdings."""

    def test_resolved_market_excluded(
        self, user_client, market_maker_client, admin_client
    ):
        from conftest import create_and_publish_market

        market = create_and_publish_market(market_maker_client, admin_client)
        yes_id = market.securities[0].id
        create_position(user_client, market.id, yes_id, 5)

        # Verify position visible before settlement
        resp = user_client.get("/users/me/portfolio")
        assert len(resp.json()["holdings"]) == 1

        # Settle the market
        admin_client.put("/markets/settle", json={"winningSecurityId": yes_id})

        # Holdings must now be empty
        resp = user_client.get("/users/me/portfolio")
        assert resp.json()["holdings"] == []

    def test_resolved_market_excluded_summary_zeroed(
        self, user_client, market_maker_client, admin_client
    ):
        from conftest import create_and_publish_market

        market = create_and_publish_market(market_maker_client, admin_client)
        yes_id = market.securities[0].id
        create_position(user_client, market.id, yes_id, 5)

        admin_client.put("/markets/settle", json={"winningSecurityId": yes_id})

        resp = user_client.get("/users/me/portfolio")
        summary = resp.json()["summary"]
        assert summary["costBasis"] == 0
        assert summary["marketValue"] == 0
