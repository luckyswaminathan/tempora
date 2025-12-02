from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.trade import (
    Leg,
    TradeCreate,
    TradeCreateRequest,
    TradeListResponse,
    TradePriceResponse,
    TradePlaceResponse,
    TradeRecord,
)
from services.markets import MarketService
from services.pricing import calculate_market_price_cents


class TradeService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(session)

    def _price_trade(self, market_id: str, legs: List[Leg]) -> float:
        market = self.market_service.get_market(market_id)
        quantities_map = {
            quote.security_id: quote.quantity_traded for quote in market.quotes
        }
        trade_map = {leg.security_id: leg.quantity for leg in legs}
        return calculate_market_price_cents(
            quantities_map, trade_map, market.liquidity_parameter
        )

    def price_trade(self, payload: TradeCreateRequest) -> TradePriceResponse:
        return TradePriceResponse.model_validate(
            {
                "priceCents": self._price_trade(payload.market_id, payload.legs),
                "pricedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    def place_trade(self, payload: TradeCreate) -> TradePlaceResponse:
        execution_price = 0.0
        trade_group_id = str(uuid4())

        for leg in payload.legs:
            price = self._price_trade(payload.market_id, [leg])
            record = models.Trade(
                user_id=payload.user_id,
                market_id=payload.market_id,
                trade_group_id=trade_group_id,
                security_id=leg.security_id,
                quantity=leg.quantity,
                price_cents=price,
                created_at=datetime.now(timezone.utc),
            )
            execution_price += price
            self.session.add(record)

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
