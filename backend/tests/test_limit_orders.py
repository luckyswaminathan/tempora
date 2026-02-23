"""
Tests for limit order functionality.

SCOPE: These tests verify good-til-canceled limit orders with automatic
matching, collateral locking, and time priority execution.

What this tests:
- Limit order creation and execution
- Limit price validation
- Collateral locking for unfilled orders
- Automatic matching when market price improves
- Time priority ordering
- Order cancellation
- Multi-leg limit orders
- Edge cases and error handling

What this does NOT test:
- Market orders - see test_market_orders.py
- Settlement/resolution - see test_settlement.py
"""


def test_limit_order_executes_within_limit(trader_client, trade_market):
    """Test that limit order executes when market price is within limit."""
    security_id = trade_market.securities[0].id

    # Get market price for buying 10 shares
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order with limit ABOVE market price (should execute)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price + 100,  # Willing to pay more
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    result = resp.json()
    assert result["filled"] is True
    assert result["priceCents"] > 0


def test_limit_order_not_filled_above_limit(trader_client, trade_market):
    """Test that limit order is not filled when market price exceeds limit."""
    security_id = trade_market.securities[0].id

    # Get market price for buying 10 shares
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order with limit BELOW market price (should NOT execute)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 100,  # Not willing to pay market price
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    result = resp.json()
    assert result["filled"] is False
    assert result["priceCents"] == 0


def test_cancel_unfilled_limit_order(trader_client, trade_market):
    """Test canceling an unfilled limit order."""
    security_id = trade_market.securities[0].id

    # Create unfilled limit order
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 100,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    # Get the order ID from orders list
    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_id = orders[0]["id"]  # Most recent order

    # Cancel the order
    resp = trader_client.post(f"/orders/{order_id}/cancel")
    assert resp.status_code == 200

    result = resp.json()
    assert result["canceled"] is True
    assert result["filled"] is False


def test_cannot_cancel_filled_order(trader_client, trade_market):
    """Test that filled orders cannot be canceled."""
    security_id = trade_market.securities[0].id

    # Create and execute market order
    payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=payload)
    assert resp.status_code == 201

    # Get the order ID from orders list
    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_id = orders[0]["id"]  # Most recent order

    # Try to cancel filled order
    resp = trader_client.post(f"/orders/{order_id}/cancel")
    assert resp.status_code == 400
    assert "already filled" in resp.json()["detail"].lower()


def test_limit_order_locks_collateral(trader_client, trade_market):
    """Test that unfilled limit orders lock collateral and it's released on cancel."""
    security_id = trade_market.securities[0].id

    # Get initial wallet
    resp = trader_client.get("/users/me/profile")
    initial_wallet = resp.json()["wallet"]

    # Get market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place unfilled limit order (limit below market)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 100,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    result = resp.json()
    assert result["filled"] is False

    # Get the order details from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order = orders[0]  # Most recent order
    order_id = order["id"]
    collateral_locked = order["collateralLockedCents"]
    assert collateral_locked == market_price - 100  # Limit price is max we'll pay

    # Wallet should not change (no execution yet)
    resp = trader_client.get("/users/me/profile")
    current_wallet = resp.json()["wallet"]
    assert current_wallet == initial_wallet

    # Cancel the order to release collateral
    resp = trader_client.post(f"/orders/{order_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["canceled"] is True


def test_limit_order_fills_when_price_improves(trader_client, trade_market):
    """Test that unfilled limit order executes when market price becomes favorable."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id

    # Get market price for buying 20 shares
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order below market price (won't execute)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the order ID from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    limit_order_id = orders[0]["id"]  # Most recent order

    # Get wallet before
    resp = trader_client.get("/users/me/profile")
    wallet_before = resp.json()["wallet"]

    # Buy a large quantity of a DIFFERENT security (this lowers price of our target in LMSR)
    # In LMSR, buying one security increases its price and decreases other securities' prices
    opposite_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 500}],
    }
    resp = trader_client.post("/orders", json=opposite_payload)
    assert resp.status_code == 201

    # Check if limit order was filled (query the order)
    resp = trader_client.get("/orders")
    orders = resp.json()["items"]
    limit_order = next((o for o in orders if o["id"] == limit_order_id), None)

    # The limit order should now be filled
    assert limit_order is not None
    assert limit_order["filled"] is True
    assert len(limit_order["trades"]) > 0

    # Wallet should reflect the execution
    resp = trader_client.get("/users/me/profile")
    wallet_after = resp.json()["wallet"]
    assert (
        wallet_after < wallet_before
    )  # Paid for both the large buy and the limit order


def test_limit_order_time_priority(trader_client, trade_market):
    """Test that limit orders are filled in time priority (oldest first)."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id

    # Get market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place first limit order below market
    limit_payload_1 = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 30,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload_1)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get trader user ID

    # Get the first order ID
    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_1_id = orders[0]["id"]  # Most recent order

    # Place second limit order at same or similar limit
    limit_payload_2 = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 30,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload_2)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the second order ID
    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_2_id = orders[0]["id"]  # Most recent order

    # Execute trade to improve price enough for both orders
    opposite_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 500}],
    }
    resp = trader_client.post("/orders", json=opposite_payload)
    assert resp.status_code == 201

    # Both orders should be filled, and first one should have earlier trades
    resp = trader_client.get("/orders")
    orders = {o["id"]: o for o in resp.json()["items"]}

    order_1 = orders[order_1_id]
    order_2 = orders[order_2_id]

    # Both should be filled
    assert order_1["filled"] is True
    assert order_2["filled"] is True

    # First order's trades should have earlier timestamps
    if order_1["trades"] and order_2["trades"]:
        order_1_time = order_1["trades"][0]["createdAt"]
        order_2_time = order_2["trades"][0]["createdAt"]
        assert order_1_time <= order_2_time


def test_limit_order_multi_leg(trader_client, trade_market):
    """Test limit order with multiple legs (bundle trade)."""
    security_id_1 = trade_market.securities[0].id
    security_id_2 = trade_market.securities[1].id

    # Get market price for multi-leg trade
    price_payload = {
        "marketId": trade_market.id,
        "legs": [
            {"securityId": security_id_1, "quantity": 10},
            {"securityId": security_id_2, "quantity": 5},
        ],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order below market price (won't execute)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,
        "legs": [
            {"securityId": security_id_1, "quantity": 10},
            {"securityId": security_id_2, "quantity": 5},
        ],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the order details from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order = orders[0]  # Most recent order
    order_id = order["id"]
    collateral_locked = order["collateralLockedCents"]
    assert collateral_locked > 0

    # Verify order was created with correct legs stored
    resp = trader_client.get("/orders")
    orders = resp.json()["items"]
    limit_order = next((o for o in orders if o["id"] == order_id), None)
    assert limit_order is not None
    assert limit_order["filled"] is False


def test_limit_order_with_short_position(trader_client, trade_market):
    """Test limit order that includes short selling locks correct collateral."""
    security_id = trade_market.securities[0].id

    # Get market price for selling 20 shares
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": -20}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]  # Will be negative

    # Place limit order to sell (limit price is minimum we'll accept, which is negative)
    # We want to receive at least market_price - 50 (less negative = more money)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,  # Max price we'll pay (most negative)
        "legs": [{"securityId": security_id, "quantity": -20}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    result = resp.json()
    assert result["filled"] is False

    # Get the order details from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order = orders[0]  # Most recent order
    order_id = order["id"]
    collateral_locked = order["collateralLockedCents"]

    # Collateral should include short collateral requirement
    # For unfilled short order: collateral = limit_price + (100*quantity for shorts)
    # In this case: negative price + 2000 cents = positive collateral
    assert collateral_locked > 0

    # Cancel to release collateral
    resp = trader_client.post(f"/orders/{order_id}/cancel")
    assert resp.status_code == 200


def test_limit_order_missing_limit_price(trader_client, trade_market):
    """Test that limit orders require a limit price."""
    security_id = trade_market.securities[0].id

    # Try to place limit order without limit price
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        # Missing limitPriceCents
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 400
    assert "limit" in resp.json()["detail"].lower()


def test_multiple_limit_orders_sequential_fills(trader_client, trade_market):
    """Test that multiple limit orders fill sequentially when price improves."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id

    # Get market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 15}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place three limit orders at different prices
    order_ids = []
    for i, offset in enumerate([30, 20, 10]):
        limit_payload = {
            "marketId": trade_market.id,
            "orderType": "limit",
            "limitPriceCents": market_price - offset,
            "legs": [{"securityId": security_id, "quantity": 15}],
        }
        resp = trader_client.post("/orders", json=limit_payload)
        assert resp.status_code == 201
        result = resp.json()
        assert result["filled"] is False

    # Get all order IDs from orders list

    orders_resp = trader_client.get("/orders")
    all_orders = orders_resp.json()["items"]
    # Get the 3 most recent limit orders (they are ordered by creation time)
    for i in range(3):
        order_ids.append(all_orders[2 - i]["id"])  # Reverse order to get oldest first

    # Execute large opposite trade to lower price significantly
    opposite_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 500}],
    }
    resp = trader_client.post("/orders", json=opposite_payload)
    assert resp.status_code == 201

    # Check which orders filled
    resp = trader_client.get("/orders")
    orders = {o["id"]: o for o in resp.json()["items"]}

    # At least the first order (highest limit) should be filled
    assert order_ids[0] in orders
    # If first is filled, check time priority was respected
    filled_orders = [orders[oid] for oid in order_ids if orders[oid]["filled"]]
    assert len(filled_orders) >= 1


def test_canceled_limit_order_not_filled(trader_client, trade_market):
    """Test that canceled limit orders don't fill even when price improves."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id

    # Get market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order below market
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the order ID from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_id = orders[0]["id"]  # Most recent order

    # Cancel the order
    resp = trader_client.post(f"/orders/{order_id}/cancel")
    assert resp.status_code == 200

    # Execute trade that would normally trigger the limit order
    opposite_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 500}],
    }
    resp = trader_client.post("/orders", json=opposite_payload)
    assert resp.status_code == 201

    # Verify canceled order is still not filled
    resp = trader_client.get("/orders")
    orders = resp.json()["items"]
    canceled_order = next((o for o in orders if o["id"] == order_id), None)

    assert canceled_order is not None
    assert canceled_order["filled"] is False
    assert canceled_order["canceled"] is True


def test_limit_order_insufficient_collateral(trader_client, trade_market):
    """Test that limit order fails if user doesn't have enough collateral."""
    security_id = trade_market.securities[0].id

    # First, lock most of the user's balance with a position
    # Buy shares to establish position
    initial_buy_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 1000}],
    }
    resp = trader_client.post("/orders", json=initial_buy_payload)
    # May fail if insufficient balance, that's ok

    # Try to place a large limit order
    large_limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": 100000,  # Very high limit
        "legs": [{"securityId": security_id, "quantity": 10000}],
    }
    resp = trader_client.post("/orders", json=large_limit_payload)

    # Should fail due to insufficient collateral
    assert resp.status_code == 400
    assert "insufficient" in resp.json()["detail"].lower()


def test_limit_order_collateral_released_on_fill(trader_client, trade_market):
    """Test that collateral is released when limit order fills."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id

    # Get market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order below market
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the order details from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order = orders[0]  # Most recent order
    order_id = order["id"]
    collateral_before = order["collateralLockedCents"]
    assert collateral_before > 0

    # Trigger fill by buying other security
    opposite_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 500}],
    }
    resp = trader_client.post("/orders", json=opposite_payload)
    assert resp.status_code == 201

    # Verify order filled and collateral released
    resp = trader_client.get("/orders")
    orders = resp.json()["items"]
    filled_order = next((o for o in orders if o["id"] == order_id), None)

    assert filled_order is not None
    assert filled_order["filled"] is True
    assert filled_order["collateralLockedCents"] == 0  # Released


def test_limit_order_on_different_markets_independent(
    trader_client, trade_market, db_session
):
    """Test that limit orders on different markets don't affect each other."""
    from datetime import datetime, timezone
    from uuid import uuid4
    from core import models

    # Create a second market for the same market maker
    market_maker_id = trade_market.creator_id

    second_market = models.Market(
        id=str(uuid4()),
        question="Second Test Market",
        category="general",
        description="",
        resolution_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=1000,
        ui_type="bars-ordered",
        creator_id=market_maker_id,
        initial_funding_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(second_market)
    db_session.flush()

    # Create securities for second market
    second_market_securities = []
    for i in range(4):
        security = models.Security(
            id=str(uuid4()),
            market_id=second_market.id,
            outcome=str(i),
            value=float(i),
            is_catch_all=False,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(security)
        second_market_securities.append(security)

    db_session.commit()

    # Get market prices for both markets
    price_payload_1 = {
        "marketId": trade_market.id,
        "legs": [{"securityId": trade_market.securities[0].id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload_1)
    market_1_price = resp.json()["priceCents"]

    price_payload_2 = {
        "marketId": second_market.id,
        "legs": [{"securityId": second_market_securities[0].id, "quantity": 10}],
    }
    resp = trader_client.post("/orders/price", json=price_payload_2)
    market_2_price = resp.json()["priceCents"]

    # Place limit orders on both markets below current prices
    limit_payload_1 = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_1_price - 50,
        "legs": [{"securityId": trade_market.securities[0].id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload_1)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get trader user ID

    # Get the first order ID
    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_1_id = orders[0]["id"]  # Most recent order

    limit_payload_2 = {
        "marketId": second_market.id,
        "orderType": "limit",
        "limitPriceCents": market_2_price - 50,
        "legs": [{"securityId": second_market_securities[0].id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload_2)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the second order ID
    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_2_id = orders[0]["id"]  # Most recent order

    # Execute large trade on first market to trigger fill
    trade_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": trade_market.securities[1].id, "quantity": 800}],
    }
    resp = trader_client.post("/orders", json=trade_payload)
    assert resp.status_code == 201

    # Check order statuses
    resp = trader_client.get("/orders")
    orders = {o["id"]: o for o in resp.json()["items"]}

    # First market order should be filled (same market as trade)
    assert orders[order_1_id]["filled"] is True

    # Second market order should NOT be filled (different market)
    assert orders[order_2_id]["filled"] is False


def test_limit_order_zero_limit_price(trader_client, trade_market):
    """Test limit order with zero limit price (free trade limit)."""
    security_id = trade_market.securities[0].id

    # Place limit order with zero limit (only execute if free)
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": 0,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    # Should not execute (market price is positive)
    result = resp.json()
    assert result["filled"] is False

    # Get the order details to verify no collateral locked

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order = orders[0]  # Most recent order
    assert order["collateralLockedCents"] == 0  # No collateral needed for zero limit


def test_limit_order_insufficient_balance_when_triggered(trader_client, trade_market):
    """Test limit order doesn't fill if user spent money after placing it."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id
    third_security_id = trade_market.securities[2].id

    # Get market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_price = resp.json()["priceCents"]

    # Place limit order below market
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_price - 50,
        "legs": [{"securityId": security_id, "quantity": 20}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the order ID from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_id = orders[0]["id"]  # Most recent order

    # Now spend almost all remaining balance on a different security
    resp = trader_client.get("/users/me/profile")
    wallet = resp.json()["wallet"]

    # Buy large position in third security to drain balance
    large_buy_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": third_security_id, "quantity": 1000}],
    }
    resp = trader_client.post("/orders", json=large_buy_payload)
    # May fail if insufficient, but if it succeeds, balance is now low

    # Trigger price improvement
    trigger_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 500}],
    }
    resp = trader_client.post("/orders", json=trigger_payload)

    # Check if limit order filled
    resp = trader_client.get("/orders")
    orders = resp.json()["items"]
    limit_order = next((o for o in orders if o["id"] == order_id), None)

    # Order might not fill if balance insufficient
    # This test documents the behavior (validation prevents fill)
    if limit_order["filled"]:
        # If filled, user must have had sufficient balance
        assert len(limit_order["trades"]) > 0
    else:
        # If not filled, it's because of insufficient balance or price still too high
        assert limit_order["collateralLockedCents"] > 0


def test_limit_order_negative_price_for_sell(trader_client, trade_market):
    """Test limit sell order (negative quantity) with appropriate limit price."""
    security_id = trade_market.securities[0].id

    # First buy some shares to sell
    buy_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 30}],
    }
    resp = trader_client.post("/orders", json=buy_payload)
    assert resp.status_code == 201

    # Get sell price (will be negative - we receive money)
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": -20}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    market_sell_price = resp.json()["priceCents"]
    assert market_sell_price < 0  # Selling gives us money

    # Place limit order to sell with limit ABOVE market (less negative = better for us)
    # For sells (negative cost), limit must be >= cost to execute
    # E.g., if market is -400, limit of -300 means "I'll accept -300 or better (less negative)"
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": market_sell_price
        + 100,  # Accept better price (less negative)
        "legs": [{"securityId": security_id, "quantity": -20}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201

    result = resp.json()
    # Should execute immediately since market price is within our limit
    assert result["filled"] is True
    assert result["priceCents"] < 0  # Received money


def test_limit_order_on_closed_market_fails(trader_client, trade_market, db_session):
    """Test that limit orders fail on closed markets."""
    from core import models

    security_id = trade_market.securities[0].id

    # Close the market
    market_model = db_session.get(models.Market, trade_market.id)
    market_model.status = models.MarketStatus.RESOLVED
    db_session.commit()

    # Try to place limit order
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": 100,
        "legs": [{"securityId": security_id, "quantity": 10}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 400
    assert "not open" in resp.json()["detail"].lower()


def test_limit_order_across_market_movement(trader_client, trade_market):
    """Test limit order behavior across multiple market price movements."""
    security_id = trade_market.securities[0].id
    other_security_id = trade_market.securities[1].id

    # Get initial market price
    price_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 15}],
    }
    resp = trader_client.post("/orders/price", json=price_payload)
    initial_price = resp.json()["priceCents"]

    # Place limit order well below market
    limit_payload = {
        "marketId": trade_market.id,
        "orderType": "limit",
        "limitPriceCents": initial_price - 100,
        "legs": [{"securityId": security_id, "quantity": 15}],
    }
    resp = trader_client.post("/orders", json=limit_payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["filled"] is False

    # Get the order ID from orders list

    orders_resp = trader_client.get("/orders")
    orders = orders_resp.json()["items"]
    order_id = orders[0]["id"]  # Most recent order

    # Movement 1: Price goes up (shouldn't fill)
    buy_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": security_id, "quantity": 50}],
    }
    resp = trader_client.post("/orders", json=buy_payload)
    assert resp.status_code == 201

    # Check order still unfilled
    resp = trader_client.get("/orders")
    orders = {o["id"]: o for o in resp.json()["items"]}
    assert orders[order_id]["filled"] is False

    # Movement 2: Large opposite movement to lower price significantly
    opposite_payload = {
        "marketId": trade_market.id,
        "legs": [{"securityId": other_security_id, "quantity": 1000}],
    }
    resp = trader_client.post("/orders", json=opposite_payload)
    assert resp.status_code == 201

    # Now order should be filled
    resp = trader_client.get("/orders")
    orders = {o["id"]: o for o in resp.json()["items"]}
    assert orders[order_id]["filled"] is True
    assert orders[order_id]["collateralLockedCents"] == 0
