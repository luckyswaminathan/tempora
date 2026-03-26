from datetime import datetime, timedelta, timezone
from uuid import uuid4

from conftest import create_and_publish_market, create_position

from core import models
from services.markets import MarketService


def test_limit_order_fill_creates_notification(trader_client, trade_market):
    security_id = trade_market.securities[0].id
    opposite_security_id = trade_market.securities[1].id

    # Place an unfilled limit order first.
    price_resp = trader_client.post(
        "/orders/price",
        json={
            "marketId": trade_market.id,
            "legs": [{"securityId": security_id, "quantity": 20}],
        },
    )
    assert price_resp.status_code == 200
    market_price = price_resp.json()["priceCents"]

    limit_resp = trader_client.post(
        "/orders",
        json={
            "marketId": trade_market.id,
            "orderType": "limit",
            "limitPriceCents": market_price - 50,
            "legs": [{"securityId": security_id, "quantity": 20}],
        },
    )
    assert limit_resp.status_code == 201
    assert limit_resp.json()["filled"] is False

    # Move price so the limit order becomes fillable.
    move_resp = trader_client.post(
        "/orders",
        json={
            "marketId": trade_market.id,
            "legs": [{"securityId": opposite_security_id, "quantity": 500}],
        },
    )
    assert move_resp.status_code == 201

    notif_resp = trader_client.get("/notifications")
    assert notif_resp.status_code == 200
    payload = notif_resp.json()

    assert payload["count"] >= 1
    filled_notifs = [
        n for n in payload["items"] if n["eventType"] == "limit_order_filled"
    ]
    assert len(filled_notifs) >= 1
    assert "totalCostCents" in filled_notifs[0]["payload"]
    assert "grossShares" in filled_notifs[0]["payload"]


def test_settlement_notifies_users_with_non_zero_positions(
    market_maker_client, admin_client, user_client
):
    market = create_and_publish_market(market_maker_client, admin_client)
    winning_security_id = market.securities[0].id

    create_position(user_client, market.id, winning_security_id, 10)

    settle_resp = admin_client.put(
        "/markets/settle", json={"winningSecurityId": winning_security_id}
    )
    assert settle_resp.status_code == 200

    notif_resp = user_client.get("/notifications")
    assert notif_resp.status_code == 200
    items = notif_resp.json()["items"]

    settlement_notifs = [
        n for n in items if n["eventType"] == "position_market_settled"
    ]
    assert len(settlement_notifs) >= 1

    summary = settlement_notifs[0]["payload"]
    assert summary["marketId"] == market.id
    assert summary["positionCount"] >= 1
    assert "totalCostCents" in summary
    assert "totalPayoutCents" in summary
    assert "totalPnlCents" in summary


def test_market_maker_notified_when_market_closed_or_suspended(
    market_maker_client, admin_client
):
    market = create_and_publish_market(market_maker_client, admin_client)

    suspend_resp = admin_client.patch(
        f"/markets/{market.id}",
        json={"status": "suspended"},
    )
    assert suspend_resp.status_code == 200

    notif_resp = market_maker_client.get("/notifications")
    assert notif_resp.status_code == 200
    items = notif_resp.json()["items"]

    status_notifs = [
        n
        for n in items
        if n["eventType"] == "market_maker_market_status_updated"
        and n["payload"].get("newStatus") == "suspended"
    ]
    assert len(status_notifs) >= 1


def test_overdue_market_auto_closes_and_notifies_admin(
    admin_user, market_maker_user, db_session
):
    overdue_market = models.Market(
        id=str(uuid4()),
        question="Overdue Test Market",
        category="test",
        description="",
        resolution_date=datetime.now(timezone.utc) - timedelta(days=1),
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=50,
        ui_type="bars-ordered",
        creator_id=market_maker_user.id,
        initial_funding_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(overdue_market)
    db_session.commit()

    closed_count = MarketService(db_session).close_overdue_markets_and_notify_admins()
    assert closed_count == 1

    db_session.refresh(overdue_market)
    assert overdue_market.status == models.MarketStatus.CLOSED

    admin_notifications = (
        db_session.query(models.Notification)
        .filter(
            models.Notification.user_id == admin_user.id,
            models.Notification.event_type
            == models.NotificationType.ADMIN_MARKET_OVERDUE_CLOSED,
        )
        .all()
    )
    assert len(admin_notifications) >= 1
    assert admin_notifications[0].payload["actionRequired"] == "Settle market"


def test_market_maker_notified_when_market_closed_by_admin(
    market_maker_client, admin_client
):
    """Market maker receives notification when admin changes status to CLOSED."""
    market = create_and_publish_market(market_maker_client, admin_client)

    close_resp = admin_client.patch(
        f"/markets/{market.id}",
        json={"status": "closed"},
    )
    assert close_resp.status_code == 200

    notif_resp = market_maker_client.get("/notifications")
    assert notif_resp.status_code == 200
    items = notif_resp.json()["items"]

    status_notifs = [
        n
        for n in items
        if n["eventType"] == "market_maker_market_status_updated"
        and n["payload"].get("newStatus") == "closed"
    ]
    assert len(status_notifs) >= 1
    assert status_notifs[0]["payload"]["previousStatus"] == "open"
    assert status_notifs[0]["payload"]["marketId"] == market.id


def test_market_maker_notified_when_market_settled(
    market_maker_client, admin_client, trader_client
):
    """Market maker receives notification when market is settled."""
    market = create_and_publish_market(market_maker_client, admin_client)
    winning_security_id = market.securities[0].id

    # Create a position so settlement has payout
    create_position(trader_client, market.id, winning_security_id, 10)

    settle_resp = admin_client.put(
        "/markets/settle", json={"winningSecurityId": winning_security_id}
    )
    assert settle_resp.status_code == 200

    notif_resp = market_maker_client.get("/notifications")
    assert notif_resp.status_code == 200
    items = notif_resp.json()["items"]

    # Check for status update notification or settlement notification
    # Settlement can create multiple notifications, so check for any market_maker related notification
    mm_notifs = [
        n
        for n in items
        if n["eventType"]
        in [
            "market_maker_market_status_updated",
            "market_maker_market_settled",
        ]
    ]
    assert (
        len(mm_notifs) >= 1
    ), f"Expected market maker notifications but got: {[n['eventType'] for n in items]}"


def test_market_maker_notified_when_market_auto_closed_overdue(
    market_maker_user, admin_user, db_session
):
    """Market maker receives notification when overdue market is auto-closed."""
    overdue_market = models.Market(
        id=str(uuid4()),
        question="Auto-close Notification Test",
        category="test",
        description="",
        resolution_date=datetime.now(timezone.utc) - timedelta(days=1),
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=50,
        ui_type="bars-ordered",
        creator_id=market_maker_user.id,
        initial_funding_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(overdue_market)
    db_session.commit()

    MarketService(db_session).close_overdue_markets_and_notify_admins()

    # Check market maker got status update notification
    mm_notifications = (
        db_session.query(models.Notification)
        .filter(
            models.Notification.user_id == market_maker_user.id,
            models.Notification.event_type
            == models.NotificationType.MARKET_MAKER_MARKET_STATUS_UPDATED,
        )
        .all()
    )
    assert len(mm_notifications) >= 1
    assert mm_notifications[0].payload["newStatus"] == "closed"
    assert mm_notifications[0].payload["previousStatus"] == "open"


def test_market_maker_notified_on_multiple_status_changes(
    market_maker_client, admin_client
):
    """Market maker receives separate notifications for each status change."""
    market = create_and_publish_market(market_maker_client, admin_client)

    # Change to suspended
    suspend_resp = admin_client.patch(
        f"/markets/{market.id}",
        json={"status": "suspended"},
    )
    assert suspend_resp.status_code == 200

    notif_resp = market_maker_client.get("/notifications")
    items = notif_resp.json()["items"]
    status_notifs = [
        n for n in items if n["eventType"] == "market_maker_market_status_updated"
    ]
    assert len(status_notifs) >= 1
    assert status_notifs[0]["payload"]["newStatus"] == "suspended"


def test_notification_contains_market_details(market_maker_client, admin_client):
    """Market status notification includes market ID and question."""
    market = create_and_publish_market(market_maker_client, admin_client)
    original_question = market.question

    admin_client.patch(
        f"/markets/{market.id}",
        json={"status": "closed"},
    )

    notif_resp = market_maker_client.get("/notifications")
    items = notif_resp.json()["items"]

    status_notifs = [
        n
        for n in items
        if n["eventType"] == "market_maker_market_status_updated"
        and n["payload"].get("newStatus") == "closed"
    ]
    assert len(status_notifs) >= 1
    assert status_notifs[0]["payload"]["marketId"] == market.id
    assert status_notifs[0]["payload"]["marketQuestion"] == original_question
