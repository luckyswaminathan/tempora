from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from supabase import Client

from schemas.market import MarketWithQuote
from schemas.trade import TradeCreate, TradeListResponse, TradeRecord
from services.markets import MarketService


class TradeService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self.market_service = MarketService(supabase)

    def place_trade(self, payload: TradeCreate) -> TradeRecord:
        market = self.market_service.get_market(payload.market_id)
        execution_price = self._determine_price(market, payload)
        shares = round((payload.stake / execution_price) * 100.0, 4)

        record = {
            "user_id": payload.user_id,
            "market_id": payload.market_id,
            "side": payload.side,
            "price_cents": execution_price,
            "shares": shares,
            "stake": round(payload.stake, 2),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Insert trade and get the created record
        response = self.supabase.table("trades").insert(record).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to book trade")
        
        created = response.data[0] if isinstance(response.data, list) else response.data
        return TradeRecord.model_validate(
            {
                "id": created["id"],
                "userId": created["user_id"],
                "marketId": created["market_id"],
                "side": created["side"],
                "priceCents": created["price_cents"],
                "shares": created["shares"],
                "stake": created["stake"],
                "createdAt": created["created_at"],
            }
        )

    def list_trades(self, *, user_id: Optional[str] = None, market_id: Optional[str] = None) -> TradeListResponse:
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
                    "side": row["side"],
                    "priceCents": row["price_cents"],
                    "shares": row["shares"],
                    "stake": row["stake"],
                    "createdAt": row["created_at"],
                }
            )
            for row in rows
        ]
        return TradeListResponse(items=items, count=len(items))

    def _determine_price(self, market: MarketWithQuote, payload: TradeCreate) -> float:
        quote = market.quote
        if payload.side == "YES":
            market_price = quote.yes_price_cents
        else:
            market_price = quote.no_price_cents

        if payload.limit_price_cents is not None:
            if payload.side == "YES" and payload.limit_price_cents < market_price:
                # Will execute at limit if price is better for user
                return payload.limit_price_cents
            if payload.side == "NO" and payload.limit_price_cents < market_price:
                return payload.limit_price_cents
        return market_price
