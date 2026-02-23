"""Collateral calculation utilities for trading."""

from __future__ import annotations

from typing import List, Tuple
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.order import Leg


def calculate_collateral_required(
    session: Session, user_id: str, legs: List[Leg]
) -> int:
    """
    Calculate collateral required for short positions.
    For shorts, we need collateral = quantity * $1 (100 cents) per share
    because that's the max payout if the outcome wins.

    We offset this by any existing long positions in the same security.
    """
    collateral_required = 0

    for leg in legs:
        if leg.quantity < 0:  # This is a short (sell) position
            # Get existing position in this security
            existing_position = get_user_position(session, user_id, leg.security_id)

            # Calculate net position after this trade
            net_position = existing_position + leg.quantity

            # If net position would be negative (short), require collateral
            if net_position < 0:
                # Collateral = |net short position| * 100 cents
                # But only for the NEW short exposure, not existing
                new_short_exposure = min(0, net_position) - min(0, existing_position)
                collateral_required += abs(new_short_exposure) * 100

    return collateral_required


def get_user_position(session: Session, user_id: str, security_id: str) -> int:
    """Get user's current net position in a security."""
    stmt = select(models.Trade).where(
        models.Trade.user_id == user_id,
        models.Trade.security_id == security_id,
    )
    trades = session.scalars(stmt).all()
    return sum(trade.quantity for trade in trades)


def get_short_positions_data(
    session: Session, user_id: str
) -> dict[str, Tuple[models.Market, List[Tuple[models.Security, int]], int]]:
    """
    Get detailed short position data grouped by market.

    Returns dict mapping market_id to:
        (market, [(security, quantity), ...], collateral_cents)

    Collateral for each market = max(abs(quantity)) * 100, since only one
    outcome can win in a mutually exclusive market.
    """
    stmt = (
        select(models.Trade)
        .join(models.Security)
        .join(models.Market, models.Security.market_id == models.Market.id)
        .where(
            models.Trade.user_id == user_id,
            models.Market.status != models.MarketStatus.RESOLVED,
        )
    )
    open_trades = session.scalars(stmt).all()

    # Group by security to get net positions
    positions_by_security = defaultdict(
        lambda: {"quantity": 0, "market_id": "", "security": None}
    )
    for trade in open_trades:
        key = trade.security_id
        positions_by_security[key]["quantity"] += trade.quantity or 0
        positions_by_security[key]["market_id"] = trade.security.market_id
        positions_by_security[key]["security"] = trade.security

    # Group short positions by market
    shorts_by_market = defaultdict(list)
    for _, data in positions_by_security.items():
        if data["quantity"] < 0:
            market_id = data["market_id"]
            shorts_by_market[market_id].append((data["security"], data["quantity"]))

    # Calculate collateral per market (max short position)
    result = {}
    for market_id, positions in shorts_by_market.items():
        # Get market object
        market = session.get(models.Market, market_id)
        if not market:
            continue

        # Find the maximum short position (most negative)
        max_short_quantity = min(qty for _, qty in positions)  # most negative
        collateral = abs(max_short_quantity) * 100

        result[market_id] = (market, positions, collateral)

    return result


def get_limit_orders_data(session: Session, user_id: str) -> List[models.Order]:
    """Get all unfilled, non-canceled limit orders for user."""
    stmt = select(models.Order).where(
        models.Order.user_id == user_id,
        models.Order.filled == False,
        models.Order.canceled == False,
        models.Order.type == models.OrderType.LIMIT,
    )
    return list(session.scalars(stmt).all())


def get_market_maker_markets_data(
    session: Session, user_id: str
) -> List[models.Market]:
    """Get all open markets created by user that have funding collateral."""
    stmt = select(models.Market).where(
        models.Market.creator_id == user_id,
        models.Market.status != models.MarketStatus.RESOLVED,
    )
    return list(session.scalars(stmt).all())


def get_user_collateral_locked(session: Session, user_id: str) -> int:
    """
    Calculate total collateral locked for:
    1. Short positions: max short per market * 100 cents (only one outcome can win)
    2. Limit orders: sum of collateral_locked_cents for all unfilled orders
    3. Market maker funding: initial_funding + revenue per market.

    Why initial_funding + revenue:
      worst-case payout at resolution = initial_funding + total_revenue_received
      (LMSR bound: max payout = b·ln(N) + all trade revenue).
      The revenue sits in the wallet but must cover that payout, so it cannot be
      treated as spendable.  Locking F + R ensures wallet ≥ payout at all times.
    """
    # Sum up collateral for short positions (per market, using max)
    short_data_by_market = get_short_positions_data(session, user_id)
    short_collateral = sum(
        collateral for _, _, collateral in short_data_by_market.values()
    )

    # Sum up limit order collateral
    limit_orders = get_limit_orders_data(session, user_id)
    limit_order_collateral = sum(
        order.collateral_locked_cents for order in limit_orders
    )

    # Market maker collateral = initial_funding + revenue (total payout obligation).
    # revenue is positive when traders are net buyers (AMM receives money, payout
    # obligation grows) and negative when traders are net sellers (AMM pays out,
    # payout obligation shrinks).  max(0, ...) guards against floating-point drift;
    # LMSR bounds guarantee revenue >= -initial_funding so this can never go negative
    # in practice.
    markets = get_market_maker_markets_data(session, user_id)
    market_maker_collateral = 0
    for market in markets:
        trades_stmt = (
            select(models.Trade)
            .join(models.Security)
            .where(models.Security.market_id == market.id)
        )
        market_trades = session.scalars(trades_stmt).all()
        revenue = sum(t.price_cents for t in market_trades)
        effective_collateral = max(0, market.initial_funding_cents + revenue)
        market_maker_collateral += effective_collateral

    return short_collateral + limit_order_collateral + market_maker_collateral


def get_spendable_balance(session: Session, user_id: str) -> int:
    """Get user's spendable balance (wallet minus locked collateral)."""
    profile = session.get(models.Profile, user_id)
    if not profile:
        return 0
    collateral_locked = get_user_collateral_locked(session, user_id)
    return max(0, profile.wallet - collateral_locked)
