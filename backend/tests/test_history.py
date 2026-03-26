"""Tests for persisted probability history snapshots."""

from datetime import timedelta

import pytest

from core import models


@pytest.mark.parametrize("trade_market", [4], indirect=True)
def test_probability_snapshot_written_for_market_order(
    trader_client, trade_market, db_session
):
    """Each filled order should store one probability row per market security."""
    target_security_id = trade_market.securities[0].id

    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": target_security_id, "quantity": 10}],
    }
    order_resp = trader_client.post("/orders", json=payload)
    assert order_resp.status_code == 201
    order_id = order_resp.json()["orderId"]

    snapshots = (
        db_session.query(models.ProbabilityHistory)
        .filter(
            models.ProbabilityHistory.market_id == trade_market.id,
            models.ProbabilityHistory.order_id == order_id,
        )
        .all()
    )

    assert len(snapshots) == len(trade_market.securities)
    assert all(0.0 <= row.probability <= 1.0 for row in snapshots)

    history_resp = trader_client.get(f"/history/probability/{target_security_id}")
    assert history_resp.status_code == 200

    # Initial point + at least one stored snapshot + trailing "now" point.
    assert len(history_resp.json()["history"]) >= 3


@pytest.mark.parametrize("trade_market", [4], indirect=True)
def test_probability_snapshot_written_when_limit_order_fills_later(
    trader_client, trade_market, db_session
):
    """Deferred limit order fills should also persist per-security snapshots."""
    buy_security_id = trade_market.securities[0].id
    opposite_security_id = trade_market.securities[1].id

    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": buy_security_id, "quantity": 20}],
    }
    price_resp = trader_client.post("/orders/price", json=price_payload)
    assert price_resp.status_code == 200
    market_price = price_resp.json()["priceCents"]

    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,
        "legs": [{"securityId": buy_security_id, "quantity": 20}],
    }
    limit_resp = trader_client.post("/orders", json=limit_payload)
    assert limit_resp.status_code == 201
    assert limit_resp.json()["filled"] is False

    orders_resp = trader_client.get("/orders")
    assert orders_resp.status_code == 200
    limit_order_id = orders_resp.json()["items"][0]["id"]

    # This trade shifts LMSR prices and should allow the limit order to fill.
    trigger_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": opposite_security_id, "quantity": 500}],
    }
    trigger_resp = trader_client.post("/orders", json=trigger_payload)
    assert trigger_resp.status_code == 201

    limit_snapshots = (
        db_session.query(models.ProbabilityHistory)
        .filter(
            models.ProbabilityHistory.market_id == trade_market.id,
            models.ProbabilityHistory.order_id == limit_order_id,
        )
        .all()
    )
    assert len(limit_snapshots) == len(trade_market.securities)


@pytest.mark.parametrize("trade_market", [4], indirect=True)
def test_read_only_market_history_has_no_trailing_now_point(
    trader_client, trade_market, db_session
):
    """Closed/resolved markets should return snapshot-only history (no synthetic now point)."""
    security_id = trade_market.securities[0].id
    market_created_at = trade_market.created_at

    # Seed one persisted snapshot and mark market as closed.
    snapshot_time = market_created_at + timedelta(hours=1)
    trade_market.status = models.MarketStatus.CLOSED
    db_session.add(
        models.ProbabilityHistory(
            market_id=trade_market.id,
            security_id=security_id,
            order_id="seed-order",
            probability=0.42,
            created_at=snapshot_time,
        )
    )
    db_session.commit()

    resp = trader_client.get(f"/history/probability/{security_id}")
    assert resp.status_code == 200
    history = resp.json()["history"]

    # Initial market point + stored snapshot only.
    assert len(history) == 2
    assert history[-1]["date"].startswith(snapshot_time.isoformat())
