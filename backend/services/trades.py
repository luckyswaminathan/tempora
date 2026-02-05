from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.market import Market
from schemas.trade import (
    Leg,
    TradeCreate,
    TradeCreateRequest,
    TradeListResponse,
    TradePriceResponse,
    TradePlaceResponse,
    TradeRecord,
    ProbabilityHistData,
    ProbabilityHistResponse,
)
from services.markets import MarketService
from services.pricing import calculate_market_price_cents, calculate_implied_probability


class TradeService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(session)

    def _price_trade(
        self,
        market: Market,
        legs: List[Leg],
        quantities_map: Optional[Dict[str, int]] = None,
    ) -> int:
        if quantities_map is None:
            quantities_map = {
                quote.security_id: quote.quantity_traded for quote in market.quotes
            }
        trade_map = {leg.security_id: leg.quantity for leg in legs}
        return calculate_market_price_cents(
            quantities_map, trade_map, market.liquidity_parameter
        )

    def price_trade(self, payload: TradeCreateRequest) -> TradePriceResponse:
        market = self.market_service.get_market(payload.market_id)
        return TradePriceResponse.model_validate(
            {
                "priceCents": self._price_trade(market, payload.legs),
                "pricedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    def _calculate_collateral_required(
        self, user_id: str, market_id: str, legs: List[Leg]
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
                existing_position = self._get_user_position(
                    user_id, market_id, leg.security_id
                )

                # Calculate net position after this trade
                net_position = existing_position + leg.quantity

                # If net position would be negative (short), require collateral
                if net_position < 0:
                    # Collateral = |net short position| * 100 cents
                    # But only for the NEW short exposure, not existing
                    new_short_exposure = min(0, net_position) - min(
                        0, existing_position
                    )
                    collateral_required += abs(new_short_exposure) * 100

        return collateral_required

    def _get_user_position(self, user_id: str, market_id: str, security_id: str) -> int:
        """Get user's current net position in a security."""
        stmt = select(models.Trade).where(
            models.Trade.user_id == user_id,
            models.Trade.market_id == market_id,
            models.Trade.security_id == security_id,
        )
        trades = self.session.scalars(stmt).all()
        return sum(trade.quantity for trade in trades)

    def _get_user_collateral_locked(self, user_id: str) -> int:
        """
        Calculate total collateral locked for all short positions.
        This is the sum of |short quantity| * 100 cents for all net short positions.
        """
        # Get all trades for open markets
        stmt = (
            select(models.Trade)
            .join(models.Market, models.Trade.market_id == models.Market.id)
            .where(
                models.Trade.user_id == user_id,
                models.Market.status != models.MarketStatus.RESOLVED,
            )
        )
        trades = self.session.scalars(stmt).all()

        # Calculate net position per security
        positions: dict[str, int] = {}
        for trade in trades:
            key = f"{trade.market_id}:{trade.security_id}"
            positions[key] = positions.get(key, 0) + trade.quantity

        # Sum up collateral for short positions
        collateral = 0
        for position in positions.values():
            if position < 0:  # Short position
                collateral += abs(position) * 100  # $1 = 100 cents per share

        return collateral

    def get_spendable_balance(self, user_id: str) -> int:
        """Get user's spendable balance (wallet minus locked collateral)."""
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            return 0
        collateral_locked = self._get_user_collateral_locked(user_id)
        return max(0, profile.wallet - collateral_locked)

    def place_trade(self, payload: TradeCreate) -> TradePlaceResponse:
        profile = self.session.get(models.Profile, payload.user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        market = self.market_service.get_market(payload.market_id)
        if market.status != models.MarketStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Market is not open for trading",
            )

        # Calculate total quoted cost needed to execute trade
        total_cost = self._price_trade(market, payload.legs)

        # Calculate additional collateral needed for short positions
        collateral_required = self._calculate_collateral_required(
            payload.user_id, payload.market_id, payload.legs
        )

        # Get current spendable balance
        current_collateral_locked = self._get_user_collateral_locked(payload.user_id)
        spendable_balance = max(0, profile.wallet - current_collateral_locked)

        # Check if user has enough spendable balance
        if total_cost > spendable_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance. Cost: ${total_cost/100:.2f}, Available: ${spendable_balance/100:.2f}",
            )

        # Check if user has enough collateral
        new_wallet = profile.wallet - total_cost
        new_collateral = current_collateral_locked + collateral_required
        if new_collateral > new_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance for collateral. Required: ${new_collateral/100:.2f}, Would have: ${new_wallet/100:.2f}",
            )

        # Track simulated market quantities for sequential execution / storage of trade
        simulated_quantities = {
            quote.security_id: quote.quantity_traded for quote in market.quotes
        }
        leg_prices_sum = 0
        trade_group_id = str(uuid4())

        for i, leg in enumerate(payload.legs):
            # For all legs except the last, calculate price sequentially
            if i < len(payload.legs) - 1:
                price = self._price_trade(market, [leg], simulated_quantities)
                leg_prices_sum += price
                simulated_quantities[leg.security_id] += leg.quantity
            else:
                # Last leg absorbs any difference to ensure exact match with quoted total
                price = total_cost - leg_prices_sum

            record = models.Trade(
                user_id=payload.user_id,
                market_id=payload.market_id,
                trade_group_id=trade_group_id,
                security_id=leg.security_id,
                quantity=leg.quantity,
                price_cents=price,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(record)

        profile.wallet -= total_cost
        self.session.commit()

        return TradePlaceResponse.model_validate(
            {
                "priceCents": total_cost,
                "executedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    def list_trades(
        self, *, user_id: Optional[str] = None, market_id: Optional[str] = None
    ) -> TradeListResponse:
        stmt = select(models.Trade).order_by(models.Trade.created_at.desc())
        if user_id:
            stmt = stmt.where(models.Trade.user_id == user_id)
        if market_id:
            stmt = stmt.where(models.Trade.market_id == market_id)

        rows = self.session.scalars(stmt).all()
        items = [
            TradeRecord.model_validate(
                {
                    "id": row.id,
                    "userId": row.user_id,
                    "marketId": row.market_id,
                    "tradeGroupId": row.trade_group_id,
                    "securityId": row.security_id,
                    "quantity": row.quantity,
                    "priceCents": row.price_cents,
                    "createdAt": row.created_at,
                }
            )
            for row in rows
        ]
        return TradeListResponse.model_validate({"items": items, "count": len(items)})

    def get_probability_history(self, security_id: str) -> ProbabilityHistResponse:
        security = self.market_service.get_security(security_id)
        market = self.market_service.get_market(security.market_id)

        stmt = (
            select(models.Trade)
            .where(models.Trade.market_id == market.id)
            .order_by(models.Trade.created_at)
        )
        trades = self.session.scalars(stmt).all()

        quantities_map = {quote.security_id: 0 for quote in market.quotes}

        # Initial probability
        probability = calculate_implied_probability(
            quantities_map, security_id, market.liquidity_parameter
        )
        history = [
            ProbabilityHistData.model_validate(
                {"probability": probability, "date": market.created_at}
            )
        ]

        # Trading history
        for i, trade in enumerate(trades):
            quantities_map[trade.security_id] += trade.quantity

            if (
                i == len(trades) - 1
                or trade.trade_group_id != trades[i + 1].trade_group_id
            ):
                probability = calculate_implied_probability(
                    quantities_map, security_id, market.liquidity_parameter
                )
                history.append(
                    ProbabilityHistData.model_validate(
                        {"probability": probability, "date": trade.created_at}
                    )
                )

        # Current probability
        history.append(
            ProbabilityHistData.model_validate(
                {
                    "probability": probability,
                    "date": datetime.now(timezone.utc).isoformat(),
                }
            )
        )

        # TODO: if market status == "resolved", then add prob at resolution time instead
        # TODO: save historical implied probabilities in table to avoid recalculation

        return ProbabilityHistResponse.model_validate({"history": history})
