from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from supabase import Client

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
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self.market_service = MarketService(supabase)

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
            record = {
                "user_id": payload.user_id,
                "market_id": payload.market_id,
                "trade_group_id": trade_group_id,
                "security_id": leg.security_id,
                "quantity": leg.quantity,
                "price_cents": price,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            execution_price += price

            # Insert trade record for leg
            response = self.supabase.table("trades").insert(record).execute()
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to book trade",
                )

        return TradePlaceResponse.model_validate(
            {
                "priceCents": execution_price,
                "executedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    def list_trades(
        self, *, user_id: Optional[str] = None, market_id: Optional[str] = None
    ) -> TradeListResponse:
        query = self.supabase.table("trades").select("*").order("created_at", desc=True)
        if user_id:
            query = query.eq("user_id", user_id)
        if market_id:
            query = query.eq("market_id", market_id)

        response = query.execute()
        rows = response.data or []
        items = [
            TradeRecord.model_validate(
                {
                    "id": row["id"],
                    "userId": row["user_id"],
                    "marketId": row["market_id"],
                    "tradeGroupId": row["trade_group_id"],
                    "securityId": row["security_id"],
                    "quantity": row["quantity"],
                    "priceCents": row["price_cents"],
                    "createdAt": row["created_at"],
                }
            )
            for row in rows
        ]
        return TradeListResponse.model_validate({"items": items, "count": len(items)})
