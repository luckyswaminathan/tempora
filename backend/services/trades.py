from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
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

    def _price_trade(self, market: Market, legs: List[Leg]) -> int:
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

    def place_trade(self, payload: TradeCreate) -> TradePlaceResponse:
        profile = self.session.get(models.Profile, payload.user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        execution_price = 0
        trade_group_id = str(uuid4())

        for leg in payload.legs:
            # Requote market after each trade leg is placed
            market = self.market_service.get_market(payload.market_id)
            if market.status != models.MarketStatus.OPEN:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Market is not open for trading",
                )

            price = self._price_trade(market, [leg])
            execution_price += price

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

        profile.wallet -= execution_price

        self.session.commit()
        return TradePlaceResponse.model_validate(
            {
                "priceCents": execution_price,
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
