"""Collateral calculation utilities for trading."""

from __future__ import annotations

from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.order import Leg


def calculate_collateral_required(
    session: Session, user_id: str, market_id: str, legs: List[Leg]
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


def get_user_collateral_locked(session: Session, user_id: str) -> int:
    """
    Calculate total collateral locked for both:
    1. Short positions: sum of |short quantity| * 100 cents for all net short positions
    2. Market maker funding: sum of funding_collateral_cents for markets created by user
    """
    # Get all trades for open markets
    stmt = (
        select(models.Trade)
        .join(models.Security)
        .join(models.Market, models.Security.market_id == models.Market.id)
        .where(
            models.Trade.user_id == user_id,
            models.Market.status != models.MarketStatus.RESOLVED,
        )
    )
    trades = session.scalars(stmt).all()

    # Calculate net position per security
    positions: dict[str, int] = {}
    for trade in trades:
        key = f"{trade.security.market_id}:{trade.security_id}"
        positions[key] = positions.get(key, 0) + trade.quantity

    # Sum up collateral for short positions
    short_collateral = 0
    for position in positions.values():
        if position < 0:  # Short position
            short_collateral += abs(position) * 100  # $1 = 100 cents per share

    # Get all markets created by this user that are not resolved
    markets_stmt = select(models.Market).where(
        models.Market.creator_id == user_id,
        models.Market.status != models.MarketStatus.RESOLVED,
    )
    markets = session.scalars(markets_stmt).all()

    # Sum up market maker funding collateral
    market_maker_collateral = sum(market.funding_collateral_cents for market in markets)

    # Get all unfilled, non-canceled limit orders for this user
    orders_stmt = select(models.Order).where(
        models.Order.user_id == user_id,
        models.Order.filled == False,
        models.Order.canceled == False,
    )
    unfilled_orders = session.scalars(orders_stmt).all()

    # Sum up collateral locked for limit orders
    limit_order_collateral = sum(
        order.collateral_locked_cents for order in unfilled_orders
    )

    return short_collateral + market_maker_collateral + limit_order_collateral


def get_spendable_balance(session: Session, user_id: str) -> int:
    """Get user's spendable balance (wallet minus locked collateral)."""
    profile = session.get(models.Profile, user_id)
    if not profile:
        return 0
    collateral_locked = get_user_collateral_locked(session, user_id)
    return max(0, profile.wallet - collateral_locked)
