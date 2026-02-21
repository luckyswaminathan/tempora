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
    OrderPlaceResponse,
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

    def _validate_balance_and_collateral(
        self,
        user_id: str,
        market_id: str,
        legs: List[Leg],
        total_cost: int,
        excluded_locked_collateral: int = 0,
        raise_on_error: bool = True,
    ) -> bool:
        """
        Validate user has sufficient balance and collateral for a trade.

        Args:
            excluded_locked_collateral: Collateral to exclude from calculation (e.g., for limit order being filled)
            raise_on_error: If True, raise HTTPException on failure. If False, return False.

        Returns:
            True if validation passes, False otherwise (when raise_on_error=False)
        """
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            if raise_on_error:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User profile not found",
                )
            return False

        collateral_required = calculate_collateral_required(
            self.session, user_id, market_id, legs
        )

        current_collateral_locked = (
            get_user_collateral_locked(self.session, user_id)
            - excluded_locked_collateral
        )

        spendable_balance = max(0, profile.wallet - current_collateral_locked)

        if total_cost > spendable_balance:
            if raise_on_error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient balance. Cost: ${total_cost/100:.2f}, Spendable: ${spendable_balance/100:.2f}",
                )
            return False

        new_wallet = profile.wallet - total_cost
        new_collateral = current_collateral_locked + collateral_required
        if new_collateral > new_wallet:
            if raise_on_error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient balance for collateral. Required: ${new_collateral/100:.2f}, Would have: ${new_wallet/100:.2f}",
                )
            return False

        return True

    def _execute_trades_for_legs(
        self,
        order: models.Order,
        legs: List[Leg],
        total_cost: int,
        market: Market,
        simulated_quantities: Dict[str, int],
    ) -> None:
        """
        Execute trades for each leg with sequential pricing.
        Updates simulated_quantities in-place.
        """
        leg_prices_sum = 0

        for i, leg in enumerate(legs):
            # For all legs except the last, calculate price sequentially
            if i < len(legs) - 1:
                price = self._price_trade(market, [leg], simulated_quantities)
                leg_prices_sum += price
                simulated_quantities[leg.security_id] += leg.quantity
            else:
                # Last leg absorbs any difference
                price = total_cost - leg_prices_sum

            trade = models.Trade(
                order_id=order.id,
                user_id=order.user_id,
                security_id=leg.security_id,
                quantity=leg.quantity,
                price_cents=price,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(trade)

            # Update simulated quantities for last leg too
            if i == len(legs) - 1:
                simulated_quantities[leg.security_id] += leg.quantity

    def _route_payment_to_market_maker(self, market_id: str, total_cost: int) -> None:
        """Route payment to market maker (if market has a creator)."""
        market_model = self.session.get(models.Market, market_id)
        if market_model and market_model.creator_id:
            creator_profile = self.session.get(models.Profile, market_model.creator_id)
            if creator_profile:
                creator_profile.wallet += total_cost

    def price_order(self, payload: OrderCreateRequest) -> OrderPriceResponse:
        market = self.market_service.get_market(payload.market_id)
        return OrderPriceResponse.model_validate(
            {
                "priceCents": self._price_trade(market, payload.legs),
                "pricedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    def place_order(self, payload: OrderCreate) -> OrderPlaceResponse:
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

        # Validate limit order has limit price
        order_type = models.OrderType(payload.order_type)
        if order_type == models.OrderType.LIMIT and payload.limit_price_cents is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit orders must specify limitPriceCents",
            )

        # Calculate total quoted cost needed to execute trade
        total_cost = self._price_trade(market, payload.legs)

        # Determine if order should be executed immediately
        should_execute = False
        if order_type == models.OrderType.MARKET:
            should_execute = True
        elif order_type == models.OrderType.LIMIT:
            # For limit orders, execute if total cost is within limit
            should_execute = total_cost <= payload.limit_price_cents

        if not should_execute:
            # Create unfilled limit order - need to lock collateral
            # Collateral = limit_price_cents (max we'll pay) + short collateral
            collateral_for_shorts = calculate_collateral_required(
                self.session, payload.user_id, payload.market_id, payload.legs
            )
            collateral_to_lock = payload.limit_price_cents + collateral_for_shorts

            # Validate user has sufficient balance for collateral
            current_collateral_locked = get_user_collateral_locked(
                self.session, payload.user_id
            )
            spendable_balance = max(0, profile.wallet - current_collateral_locked)

            if collateral_to_lock > spendable_balance:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient balance for limit order collateral. Required: ${collateral_to_lock/100:.2f}, Available: ${spendable_balance/100:.2f}",
                )

            order = models.Order(
                type=order_type,
                user_id=payload.user_id,
                market_id=payload.market_id,
                legs=[leg.model_dump() for leg in payload.legs],
                limit_price_cents=payload.limit_price_cents,
                collateral_locked_cents=collateral_to_lock,
                created_at=datetime.now(timezone.utc),
                filled=False,
            )
            self.session.add(order)
            self.session.commit()
            self.session.refresh(order)

            return OrderPlaceResponse.model_validate(
                {
                    "order": {
                        "id": order.id,
                        "type": order.type,
                        "userId": order.user_id,
                        "marketId": order.market_id,
                        "limitPriceCents": order.limit_price_cents,
                        "collateralLockedCents": order.collateral_locked_cents,
                        "createdAt": order.created_at,
                        "filled": False,
                        "canceled": False,
                        "trades": [],
                        "priceCents": 0,
                    },
                    "filled": False,
                }
            )

        # Execute order: validate balance and collateral
        self._validate_balance_and_collateral(
            payload.user_id,
            payload.market_id,
            payload.legs,
            total_cost,
            raise_on_error=True,
        )

        # Track simulated market quantities for sequential execution / storage of trade
        simulated_quantities = {
            quote.security_id: quote.quantity_traded for quote in market.quotes
        }

        # Create order record
        order = models.Order(
            type=order_type,
            user_id=payload.user_id,
            market_id=payload.market_id,
            limit_price_cents=payload.limit_price_cents,
            created_at=datetime.now(timezone.utc),
            filled=True,
        )
        self.session.add(order)
        self.session.flush()  # Get the order ID

        # Execute trades for each leg
        self._execute_trades_for_legs(
            order, payload.legs, total_cost, market, simulated_quantities
        )

        profile.wallet -= total_cost

        # Route payment to market maker
        self._route_payment_to_market_maker(payload.market_id, total_cost)

        self.session.commit()
        self.session.refresh(order)

        # Process any unfilled limit orders that might now be fillable
        self.process_limit_orders(payload.market_id)

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

        return OrderPlaceResponse.model_validate(
            {
                "order": {
                    "id": order.id,
                    "type": order.type,
                    "userId": order.user_id,
                    "marketId": order.market_id,
                    "limitPriceCents": order.limit_price_cents,
                    "collateralLockedCents": order.collateral_locked_cents,
                    "createdAt": order.created_at,
                    "filled": order.filled,
                    "canceled": order.canceled,
                    "trades": trade_items,
                    "priceCents": sum(t.price_cents for t in order.trades),
                },
                "filled": True,
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
                    "limitPriceCents": order.limit_price_cents,
                    "collateralLockedCents": order.collateral_locked_cents,
                    "createdAt": order.created_at,
                    "filled": order.filled,
                    "canceled": order.canceled,
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

    def cancel_order(self, order_id: str, user_id: str) -> OrderRecord:
        """Cancel an unfilled order."""
        order = self.session.get(models.Order, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

        # Verify user owns this order
        if order.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot cancel another user's order",
            )

        # Can only cancel unfilled, non-canceled orders
        if order.filled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel an already filled order",
            )

        if order.canceled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order is already canceled",
            )

        order.canceled = True
        self.session.commit()
        self.session.refresh(order)

        return OrderRecord.model_validate(
            {
                "id": order.id,
                "type": order.type,
                "userId": order.user_id,
                "marketId": order.market_id,
                "limitPriceCents": order.limit_price_cents,
                "collateralLockedCents": order.collateral_locked_cents,
                "createdAt": order.created_at,
                "filled": order.filled,
                "canceled": order.canceled,
                "trades": [],
                "priceCents": 0,
            }
        )

    def process_limit_orders(self, market_id: str) -> List[str]:
        """
        Process all unfilled limit orders for a market after a trade executes.
        Returns list of order IDs that were filled.

        Orders are processed in time priority (oldest first). Each order is priced
        against the current market state, and if it can be filled within its limit
        price, it is executed immediately.
        """
        # Get market with current state
        market = self.market_service.get_market(market_id)

        # Get all unfilled, non-canceled limit orders for this market, ordered by time
        stmt = (
            select(models.Order)
            .where(
                models.Order.market_id == market_id,
                models.Order.filled == False,
                models.Order.canceled == False,
                models.Order.type == models.OrderType.LIMIT,
            )
            .order_by(models.Order.created_at)
        )
        unfilled_orders = self.session.scalars(stmt).all()

        filled_order_ids = []

        # Track simulated market quantities as we execute orders
        simulated_quantities = {
            quote.security_id: quote.quantity_traded for quote in market.quotes
        }

        for order in unfilled_orders:
            # Convert stored legs JSON back to Leg objects
            legs = [Leg.model_validate(leg_dict) for leg_dict in (order.legs or [])]
            if not legs:
                continue

            # Price this order against current (simulated) market state
            total_cost = self._price_trade(market, legs, simulated_quantities)

            # Check if order can be filled within limit
            if total_cost > order.limit_price_cents:
                continue  # Skip this order, price too high

            # Validate user still has sufficient balance
            if not self._validate_balance_and_collateral(
                order.user_id,
                market_id,
                legs,
                total_cost,
                excluded_locked_collateral=order.collateral_locked_cents,
                raise_on_error=False,
            ):
                continue

            # Get profile for wallet update
            profile = self.session.get(models.Profile, order.user_id)
            if not profile:
                continue

            # Execute the trades
            self._execute_trades_for_legs(
                order, legs, total_cost, market, simulated_quantities
            )

            # Update wallet and order status
            profile.wallet -= total_cost
            order.filled = True
            order.collateral_locked_cents = 0  # Release locked collateral

            # Route payment to market maker
            self._route_payment_to_market_maker(market_id, total_cost)

            filled_order_ids.append(order.id)

        # Commit all fills at once
        if filled_order_ids:
            self.session.commit()

        return filled_order_ids
