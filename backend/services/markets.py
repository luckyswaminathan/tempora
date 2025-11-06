from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from fastapi import HTTPException, status
from supabase import Client

from core.config import settings
from schemas.market import (
    MarketCreate,
    MarketListResponse,
    MarketUpdate,
    MarketWithQuote,
    SettlementDate,
)
from services.pricing import MarketPricingInputs, calculate_market_quote


class MarketService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase

    def list_markets(self, *, category: Optional[str] = None, status_filter: Optional[str] = None) -> MarketListResponse:
        query = self.supabase.table("markets").select("*")
        if category:
            query = query.eq("category", category)
        if status_filter:
            query = query.eq("status", status_filter)

        response = query.order("created_at", desc=True).execute()
        records = response.data or []
        items = [self._attach_quote(record) for record in records]
        return MarketListResponse(items=items, count=len(items))

    def get_market(self, market_id: str) -> MarketWithQuote:
        response = self.supabase.table("markets").select("*").eq("id", market_id).single().execute()
        record = response.data
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market not found")
        return self._attach_quote(record)

    def create_market(self, payload: MarketCreate) -> MarketWithQuote:
        record = {
            "question": payload.question,
            "category": payload.category,
            "description": payload.description,
            "resolution_date": payload.resolution_date.isoformat(),
            "status": "open",
            "tags": payload.tags,
            "baseline_probability": payload.initial_liquidity / 1000.0,
            "initial_liquidity": payload.initial_liquidity,
            "settlement_dates": self._generate_settlement_dates(payload.resolution_date),
        }

        response = self.supabase.table("markets").insert(record).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create market")
        created = response.data[0] if isinstance(response.data, list) else response.data
        return self._attach_quote(created)

    def update_market(self, market_id: str, payload: MarketUpdate) -> MarketWithQuote:
        update: dict[str, Any] = {}
        if payload.question is not None:
            update["question"] = payload.question
        if payload.category is not None:
            update["category"] = payload.category
        if payload.description is not None:
            update["description"] = payload.description
        if payload.resolution_date is not None:
            update["resolution_date"] = payload.resolution_date.isoformat()
        if payload.status is not None:
            update["status"] = payload.status
        if payload.tags is not None:
            update["tags"] = payload.tags

        if not update:
            return self.get_market(market_id)

        response = self.supabase.table("markets").update(update).eq("id", market_id).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market not found")
        updated = response.data[0] if isinstance(response.data, list) else response.data
        return self._attach_quote(updated)

    def _attach_quote(self, record: dict[str, Any]) -> MarketWithQuote:
        depth = self._market_depth(record["id"])
        inputs = MarketPricingInputs(
            baseline_probability=record.get("baseline_probability", settings.pricing_baseline / 100.0),
            yes_shares=depth["yes_shares"],
            no_shares=depth["no_shares"],
            liquidity=record.get("initial_liquidity", depth["yes_shares"] + depth["no_shares"] + 1.0),
        )
        quote = calculate_market_quote(inputs)
        total_volume = depth["total_volume"]
        open_interest = depth["yes_shares"] + depth["no_shares"]

        settlement_dates = [
            self._map_settlement_date(entry) for entry in (record.get("settlement_dates") or [])
        ]

        mapped = {
            "id": record["id"],
            "question": record["question"],
            "category": record.get("category", "General"),
            "status": record.get("status", "open"),
            "resolutionDate": record["resolution_date"],
            "createdAt": record.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "updatedAt": record.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            "description": record.get("description"),
            "tags": record.get("tags") or [],
            "openInterest": round(open_interest, 2),
            "totalVolume": round(total_volume, 2),
            "quote": quote,
            "settlementDates": settlement_dates,
        }
        return MarketWithQuote.model_validate(mapped)

    def _market_depth(self, market_id: str) -> dict[str, float]:
        response = (
            self.supabase.table("trades")
            .select("side, shares, stake")
            .eq("market_id", market_id)
            .execute()
        )
        rows = response.data or []
        yes_shares = sum(row.get("shares", 0.0) for row in rows if row.get("side") == "YES")
        no_shares = sum(row.get("shares", 0.0) for row in rows if row.get("side") == "NO")
        total_volume = sum(row.get("stake", 0.0) for row in rows)
        return {"yes_shares": yes_shares, "no_shares": no_shares, "total_volume": total_volume}

    def _generate_settlement_dates(self, resolution_date: datetime) -> list[dict[str, str]]:
        from datetime import timedelta

        midpoint = resolution_date - timedelta(days=90)
        return [
            {"label": "Midpoint Review", "date": midpoint.isoformat()},
            {"label": "Final Settlement", "date": resolution_date.isoformat()},
        ]

    def _map_settlement_date(self, entry: Any) -> SettlementDate:
        if isinstance(entry, dict):
            date_value = entry.get("date")
            if isinstance(date_value, str):
                date_value = date_value.replace("Z", "+00:00")
                parsed_date = datetime.fromisoformat(date_value)
            elif isinstance(date_value, datetime):
                parsed_date = date_value
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Malformed settlement date payload stored in database",
                )
            return SettlementDate(
                label=entry.get("label", "Settlement"),
                date=parsed_date,
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Malformed settlement date payload stored in database",
        )
