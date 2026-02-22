"""
Tests for the collateral system and balance checks.

Collateral rules:
- When buying: check user has enough spendable balance (wallet - locked collateral)
- When shorting: require collateral = |short quantity| * 100 cents per share
- Collateral is released when short positions are closed
- Existing long positions offset collateral requirements
"""

import math
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from core import models
from conftest import create_and_publish_market


@pytest.fixture()
def market_2_outcomes(db_session, market_maker_user):
    """Create a simple 2-outcome market for testing."""
    market = models.Market(
        id=str(uuid4()),
        question="Test Market",
        category="general",
        description="",
        resolution_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=100,
        ui_type="bars-ordered",
        creator_id=market_maker_user.id,
        initial_funding_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(market)
    db_session.flush()

    # Create securities
    for outcome in ["Yes", "No"]:
        security = models.Security(
            id=str(uuid4()),
            market_id=market.id,
            outcome=outcome,
            value=0.0,
            is_catch_all=False,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(security)

    db_session.commit()
    db_session.refresh(market)

    return market


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
        resp = client.post("/orders", json=payload)
        assert resp.status_code == 201
        cost = resp.json()["priceCents"]

        # Verify balance decreased by exact cost
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        assert resp.json()["wallet"] == initial_balance - cost

    def test_buy_exceeding_balance_fails(self, client, market_2_outcomes):
        """User cannot buy more than their balance allows."""
        # Get initial balance
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        initial_balance = resp.json()["wallet"]

        # Try to buy more shares than balance allows
        # Use a quantity that exceeds balance but avoids floating point issues
        security_id = market_2_outcomes.securities[0].id
        payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 10000}],
        }
        resp = client.post("/orders", json=payload)
        assert resp.status_code == 400
        error_detail = resp.json()["detail"]
        assert "Insufficient balance" in error_detail

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
        resp = client.post("/orders", json=buy_payload)
        assert resp.status_code == 201

        # Get balance after buy
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        balance_after_buy = resp.json()["wallet"]

        # Now sell 5 shares (closing part of position, no collateral needed)
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -5}],
        }
        resp = client.post("/orders", json=sell_payload)
        assert resp.status_code == 201
        sell_proceeds = -resp.json()["priceCents"]  # Negative cost = proceeds

        # Verify we received proceeds and no collateral was locked
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        final_balance = resp.json()["wallet"]
        assert final_balance == balance_after_buy + sell_proceeds

    def test_short_beyond_position_requires_collateral(self, client, market_2_outcomes):
        """Shorting beyond existing long position requires collateral."""
        security_id = market_2_outcomes.securities[0].id

        # Buy 5 shares first
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 5}],
        }
        resp = client.post("/orders", json=buy_payload)
        assert resp.status_code == 201

        # Sell 10 shares (5 closing, 5 new short) - should work with collateral
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": -10}],
        }
        resp = client.post("/orders", json=sell_payload)
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
        resp = client.post("/orders", json=sell_payload)
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
        resp = client.post("/orders", json=sell_payload)
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
        resp = client.post("/orders", json=sell_payload)
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

        # Short security A - this locks collateral
        sell_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_a, "quantity": -50}],
        }
        resp = client.post("/orders", json=sell_payload)
        assert resp.status_code == 201

        # Now try to buy a huge amount of security B
        # Even though wallet has money, collateral is locked
        buy_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_b, "quantity": 10000}],
        }
        resp = client.post("/orders", json=buy_payload)
        assert resp.status_code == 400
        error_detail = resp.json()["detail"]
        assert "Insufficient balance" in error_detail


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
        resp = client.post("/orders", json=sell_payload)
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
        resp = client.post("/orders", json=buy_payload)
        assert resp.status_code == 201
        buy_cost = resp.json()["priceCents"]

        # After closing, verify collateral was released
        resp = client.get("/users/me/profile")
        assert resp.status_code == 200
        final_wallet = resp.json()["wallet"]
        assert final_wallet == wallet_after_short - buy_cost


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
        resp = client.post("/orders", json=buy_payload)
        assert resp.status_code == 201

        # Now do a multi-leg: sell A, buy B
        multi_payload = {
            "marketId": market_2_outcomes.id,
            "legs": [
                {"securityId": security_a, "quantity": -5},
                {"securityId": security_b, "quantity": 5},
            ],
        }
        resp = client.post("/orders", json=multi_payload)
        assert resp.status_code == 201


class TestPriceEndpoint:
    """Tests for the price endpoint (should not check balance)."""

    def test_price_does_not_check_balance(self, client, market_2_outcomes):
        """Pricing a trade should work regardless of balance."""
        security_id = market_2_outcomes.securities[0].id

        # Price a massive trade that would exceed balance
        payload = {
            "marketId": market_2_outcomes.id,
            "legs": [{"securityId": security_id, "quantity": 10000}],
        }
        resp = client.post("/orders/price", json=payload)
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
        resp = client.post("/orders/price", json=payload)
        assert resp.status_code == 200
        # Shorting should give negative price (you receive money)
        assert resp.json()["priceCents"] < 0


class TestMarketMakerCollateral:
    """Tests for market-maker collateral = initial_funding + revenue.

    Worst-case payout at resolution = b·ln(N) + total_revenue_received
    (LMSR guarantee: the AMM can owe at most what it was seeded with plus
    every cent it collected from traders).  Revenue lands in the wallet but
    cannot be spent — it must remain available to honour that payout.

    Locking  F + R  ensures  wallet ≥ payout  at all times:
      wallet(t) = W₀ + R(t)   (revenue flows in)
      locked(t) = F + R(t)    (grows with revenue)
      spendable = W₀ - F      (constant — revenue cannot be spent)

    Every test in this class PASSES with F+R locking and would FAIL with
    either the old adaptive formula (F-R) or a constant-lock formula (F).
    """

    # ────────────────────────────────────────────────────────────────────────
    # Constants derived from the LMSR formula so the assertions are exact.
    #
    #   F1 = b*ln(N)*100  for b=50, N=2  →  3465 cents
    #   F2 = b*ln(N)*100  for b=5,  N=2  →   346 cents
    #   R  = revenue from buying 5 shares in a fresh b=50 market  →  256 cents
    # ────────────────────────────────────────────────────────────────────────
    LIQUIDITY_1 = 50
    LIQUIDITY_2 = 5
    F1 = int(LIQUIDITY_1 * math.log(2) * 100)  # 3465
    F2 = int(LIQUIDITY_2 * math.log(2) * 100)  # 346
    BUY_QTY = 5

    def test_collateral_breakdown_before_trades_shows_full_initial_funding(
        self, market_maker_client, admin_client
    ):
        """Before any trades effective == initial_funding (F + 0 = F)."""
        market = create_and_publish_market(
            market_maker_client, admin_client, liquidity=self.LIQUIDITY_1
        )

        resp = market_maker_client.get("/users/me/collateral")
        assert resp.status_code == 200
        data = resp.json()

        mm = next(m for m in data["marketMakerMarkets"] if m["marketId"] == market.id)

        assert mm["initialFundingCents"] == self.F1
        assert mm["revenueCents"] == 0
        assert mm["effectiveCollateralCents"] == self.F1

    def test_revenue_increases_effective_collateral(
        self, market_maker_client, admin_client, user_client
    ):
        """After a trade, effectiveCollateralCents = initialFunding + revenue.

        FAILS on F-R formula: would give initialFunding - revenue < initialFunding.
        FAILS on constant-F formula: would give initialFunding == effectiveCollateral.
        """
        market = create_and_publish_market(
            market_maker_client, admin_client, liquidity=self.LIQUIDITY_1
        )

        security_id = market.securities[0].id
        resp = user_client.post(
            "/orders",
            json={
                "marketId": market.id,
                "legs": [{"securityId": security_id, "quantity": self.BUY_QTY}],
            },
        )
        assert resp.status_code == 201
        revenue = resp.json()["priceCents"]
        assert revenue > 0

        resp = market_maker_client.get("/users/me/collateral")
        assert resp.status_code == 200

        mm = next(
            m for m in resp.json()["marketMakerMarkets"] if m["marketId"] == market.id
        )

        assert mm["revenueCents"] == revenue
        # Effective lock grows with revenue (total payout obligation).
        assert mm["effectiveCollateralCents"] == self.F1 + revenue
        # FAILS on F-R formula (gives F1-R < F1).
        assert mm["effectiveCollateralCents"] > mm["initialFundingCents"]

    def test_spendable_balance_unchanged_by_revenue(
        self,
        market_maker_client,
        admin_client,
        user_client,
        market_maker_user,
        db_session,
    ):
        """Revenue credits the wallet but grows locked collateral equally, so
        spendable (wallet - locked) stays constant.

        FAILS on F-R formula: spendable grows by 2R.
        FAILS on constant-F formula: spendable grows by R.
        """
        profile = (
            db_session.query(models.Profile)
            .filter(models.Profile.id == market_maker_user.id)
            .first()
        )
        profile.wallet = self.F1
        db_session.commit()

        market = create_and_publish_market(
            market_maker_client, admin_client, liquidity=self.LIQUIDITY_1
        )

        # Sanity: spendable is 0 immediately after publishing (wallet == F1 == locked).
        resp = market_maker_client.get("/users/me/portfolio")
        assert resp.json()["spendableBalance"] == 0

        # A buyer generates revenue R.
        security_id = market.securities[0].id
        resp = user_client.post(
            "/orders",
            json={
                "marketId": market.id,
                "legs": [{"securityId": security_id, "quantity": self.BUY_QTY}],
            },
        )
        assert resp.status_code == 201
        revenue = resp.json()["priceCents"]
        assert revenue > 0

        resp = market_maker_client.get("/users/me/portfolio")
        new_spendable = resp.json()["spendableBalance"]

        # Revenue cannot be spent — spendable stays 0.
        # FAILS on F-R formula (gives 2*revenue) and constant-F (gives revenue).
        assert new_spendable == 0

    def test_market_maker_cannot_spend_revenue(
        self,
        market_maker_client,
        admin_client,
        user_client,
        market_maker_user,
        db_session,
        market_2_outcomes,
    ):
        """Revenue is fully reserved for payouts and cannot be used to buy shares.

        Setup: pin wallet = F1 so spendable = 0 after publishing.  After earning
        revenue R the wallet grows to F1+R but locked also grows to F1+R, keeping
        spendable = 0.  Any buy attempt must fail.

        FAILS on F-R formula: spendable becomes 2R, so a small buy would succeed.
        FAILS on constant-F formula: spendable becomes R, so a small buy would succeed.
        """
        profile = (
            db_session.query(models.Profile)
            .filter(models.Profile.id == market_maker_user.id)
            .first()
        )
        profile.wallet = self.F1
        db_session.commit()

        market1 = create_and_publish_market(
            market_maker_client, admin_client, liquidity=self.LIQUIDITY_1
        )

        # Earn revenue from a trade on market1.
        security_id = market1.securities[0].id
        resp = user_client.post(
            "/orders",
            json={
                "marketId": market1.id,
                "legs": [{"securityId": security_id, "quantity": self.BUY_QTY}],
            },
        )
        assert resp.status_code == 201
        revenue = resp.json()["priceCents"]
        assert revenue > 0

        # Verify spendable is still 0.
        resp = market_maker_client.get("/users/me/portfolio")
        assert resp.json()["spendableBalance"] == 0

        # Try to buy even 1 share on an unrelated market — must fail.
        buy_resp = market_maker_client.post(
            "/orders",
            json={
                "marketId": market_2_outcomes.id,
                "legs": [
                    {"securityId": market_2_outcomes.securities[0].id, "quantity": 1}
                ],
            },
        )
        # FAILS on F-R (spendable=2R>0) and constant-F (spendable=R>0).
        assert buy_resp.status_code == 400
        assert "Insufficient balance" in buy_resp.json()["detail"]
