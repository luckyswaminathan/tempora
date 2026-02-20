from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.market import Market
from schemas.order import (
    Leg,
    OrderCreate,
    OrderCreateRequest,
    OrderPriceResponse,
    OrderRecord,
    OrderListResponse,
    TradeRecord,
)
from services.markets import MarketService
from utils.pricing import calculate_market_price_cents
from utils.collateral import calculate_collateral_required, get_user_collateral_locked


class OrderService:
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

    def price_order(self, payload: OrderCreateRequest) -> OrderPriceResponse:
        market = self.market_service.get_market(payload.market_id)
        return OrderPriceResponse.model_validate(
            {
                "priceCents": self._price_trade(market, payload.legs),
                "pricedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    def place_order(self, payload: OrderCreate) -> OrderRecord:
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

        # Validate all securities belong to this market
        for leg in payload.legs:
            security = self.market_service.get_security(leg.security_id)
            if security.market_id != payload.market_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Security {leg.security_id} does not belong to market {payload.market_id}",
                )

        # Calculate total quoted cost needed to execute trade
        total_cost = self._price_trade(market, payload.legs)

        # Calculate additional collateral needed for short positions
        collateral_required = calculate_collateral_required(
            self.session, payload.user_id, payload.market_id, payload.legs
        )

        # Get current spendable balance
        current_collateral_locked = get_user_collateral_locked(
            self.session, payload.user_id
        )
        spendable_balance = max(0, profile.wallet - current_collateral_locked)

        # Check if user has enough spendable balance
        if total_cost > spendable_balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance. Cost: ${total_cost/100:.2f}, Spendable: ${spendable_balance/100:.2f}",
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

        # Create order record
        order = models.Order(
            type=models.OrderType.MARKET,
            user_id=payload.user_id,
            market_id=payload.market_id,
            created_at=datetime.now(timezone.utc),
            filled=True,
        )
        self.session.add(order)
        self.session.flush()  # Get the order ID

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
                order_id=order.id,
                user_id=payload.user_id,
                security_id=leg.security_id,
                quantity=leg.quantity,
                price_cents=price,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(record)

        profile.wallet -= total_cost

        # Route payment to market maker (if market has a creator)
        market_model = self.session.get(models.Market, payload.market_id)
        if market_model and market_model.creator_id:
            creator_profile = self.session.get(models.Profile, market_model.creator_id)
            if creator_profile:
                creator_profile.wallet += total_cost

        self.session.commit()
        self.session.refresh(order)

        # Build the order response with trades
        trade_items = [
            TradeRecord.model_validate(
                {
                    "id": t.id,
                    "securityId": t.security_id,
                    "quantity": t.quantity,
                    "priceCents": t.price_cents,
                    "createdAt": t.created_at,
                }
            )
            for t in order.trades
        ]

        return OrderRecord.model_validate(
            {
                "id": order.id,
                "type": order.type,
                "userId": order.user_id,
                "marketId": order.market_id,
                "createdAt": order.created_at,
                "filled": order.filled,
                "trades": trade_items,
                "priceCents": sum(t.price_cents for t in order.trades),
            }
        )

    def list_orders(
        self, *, user_id: Optional[str] = None, market_id: Optional[str] = None
    ) -> OrderListResponse:
        stmt = select(models.Order).order_by(models.Order.created_at.desc())
        if user_id:
            stmt = stmt.where(models.Order.user_id == user_id)
        if market_id:
            # Filter orders by market_id directly
            stmt = stmt.where(models.Order.market_id == market_id)

        orders = self.session.scalars(stmt).all()
        items = [
            OrderRecord.model_validate(
                {
                    "id": order.id,
                    "type": order.type,
                    "userId": order.user_id,
                    "marketId": order.market_id,
                    "createdAt": order.created_at,
                    "filled": order.filled,
                    "trades": [
                        TradeRecord.model_validate(
                            {
                                "id": t.id,
                                "securityId": t.security_id,
                                "quantity": t.quantity,
                                "priceCents": t.price_cents,
                                "createdAt": t.created_at,
                            }
                        )
                        for t in order.trades
                    ],
                    "priceCents": sum(t.price_cents for t in order.trades),
                }
            )
            for order in orders
        ]
        return OrderListResponse.model_validate({"items": items, "count": len(items)})
