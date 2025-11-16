from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from supabase import Client

from schemas.trade import (
    TradeCreate,
    TradeCreateRequest,
    TradeListResponse,
    TradePriceResponse,
    TradeRecord,
)
from services.markets import MarketService
from services.pricing import calculate_market_price_cents


class TradeService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self.market_service = MarketService(supabase)

    def _price_trade(self, security_id: str, quantity: int) -> float:
        security = self.market_service.get_security(security_id)
        market = self.market_service.get_market(security.market_id)
        return calculate_market_price_cents(
            {quote.security_id: quote.quantity_traded for quote in market.quotes},
            {security_id: quantity},
            market.liquidity_parameter,
        )

    def price_trade(self, payload: TradeCreateRequest) -> TradePriceResponse:
        return TradePriceResponse.model_validate(
            {
                "price": self._price_trade(
                    payload.security_id, quantity=payload.quantity
                ),
                "priced_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    def place_trade(self, payload: TradeCreate) -> TradeRecord:
        security = self.market_service.get_security(payload.security_id)
        market = self.market_service.get_market(security.market_id)
        execution_price = self._price_trade(
            payload.security_id, quantity=payload.quantity
        )

        record = {
            "user_id": payload.user_id,
            "market_id": market.id,
            "security_id": security.id,
            "quantity": payload.quantity,
            "price_cents": execution_price,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Insert trade and get the created record
        response = self.supabase.table("trades").insert(record).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to book trade",
            )

        created = response.data[0] if isinstance(response.data, list) else response.data
        return TradeRecord.model_validate(
            {
                "id": created["id"],
                "userId": created["user_id"],
                "marketId": created["market_id"],
                "securityId": created["security_id"],
                "quantity": created["quantity"],
                "priceCents": created["price_cents"],
                "createdAt": created["created_at"],
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
                    "securityId": row["security_id"],
                    "quantity": row["quantity"],
                    "priceCents": row["price_cents"],
                    "createdAt": row["created_at"],
                }
            )
            for row in rows
        ]
        return TradeListResponse(items=items, count=len(items))
