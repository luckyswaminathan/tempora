from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from supabase import Client

from schemas.market import (
    MarketCreate,
    MarketListResponse,
    MarketStatus,
    MarketUpdate,
    Market,
    Security,
    SettlementDate,
)
from schemas.trade import TradeRecord
from services.pricing import calculate_market_quotes


class MarketService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase

    def list_markets(
        self, *, category: Optional[str] = None, status_filter: Optional[str] = None
    ) -> MarketListResponse:
        query = self.supabase.table("markets").select("*")
        if category:
            query = query.eq("category", category)
        if status_filter:
            query = query.eq("status", status_filter)

        response = query.order("created_at", desc=True).execute()
        records = response.data or []
        items = [self._attach_quote(record) for record in records]
        return MarketListResponse(items=items, count=len(items))

    def get_market(self, market_id: str) -> Market:
        response = (
            self.supabase.table("markets")
            .select("*")
            .eq("id", market_id)
            .single()
            .execute()
        )
        record = response.data
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Market not found"
            )
        return self._attach_quote(record)

    def create_market(self, payload: MarketCreate) -> Market:
        record = {
            "question": payload.question,
            "category": payload.category,
            "description": payload.description,
            "resolution_date": payload.resolution_date.isoformat(),
            "status": MarketStatus.OPEN,
            "tags": payload.tags,
            "liquidity_parameter": payload.liquidity_parameter,
            "settlement_dates": self._generate_settlement_dates(
                payload.resolution_date
            ),
        }

        response = self.supabase.table("markets").insert(record).execute()
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create market",
            )
        created = response.data[0] if isinstance(response.data, list) else response.data
        self._create_securities(created["id"], payload.outcomes)
        return self._attach_quote(created)

    def update_market(self, market_id: str, payload: MarketUpdate) -> Market:
        update: Dict[str, Any] = {}
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

        response = (
            self.supabase.table("markets").update(update).eq("id", market_id).execute()
        )
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Market not found"
            )
        updated = response.data[0] if isinstance(response.data, list) else response.data
        return self._attach_quote(updated)

    def _attach_quote(self, record: Dict[str, Any]) -> Market:
        trades = self._get_trades(record["id"])
        securities = self._get_market_securities(record["id"])
        quantities = self._get_quantities(trades, securities)
        quotes = calculate_market_quotes(quantities, record.get("liquidity_parameter"))
        total_volume = self._get_total_volume(trades)
        open_interest = self._get_open_interest(trades)

        settlement_dates = [
            self._map_settlement_date(entry)
            for entry in (record.get("settlement_dates") or [])
        ]

        mapped = {
            "id": record["id"],
            "question": record["question"],
            "category": record.get("category", "General"),
            "status": record.get("status", MarketStatus.OPEN),
            "resolutionDate": record["resolution_date"],
            "createdAt": record.get("created_at")
            or datetime.now(timezone.utc).isoformat(),
            "updatedAt": record.get("updated_at")
            or datetime.now(timezone.utc).isoformat(),
            "description": record.get("description"),
            "tags": record.get("tags") or [],
            "quotes": quotes,
            "securities": securities,
            "openInterest": round(open_interest, 2),
            "totalVolume": round(total_volume, 2),
            "liquidity_parameter": record.get("liquidity_parameter"),
            "settlementDates": settlement_dates,
        }
        return Market.model_validate(mapped)

    def _get_trades(self, market_id: str) -> List[TradeRecord]:
        trades = []
        response = (
            self.supabase.table("trades")
            .select("*")
            .eq("market_id", market_id)
            .execute()
        )
        rows = response.data or []
        for row in rows:
            mapped = {
                "id": row.get("id"),
                "user_id": row.get("user_id"),
                "market_id": market_id,
                "security_id": row.get("security_id"),
                "quantity": row.get("quantity"),
                "price_cents": row.get("price_cents"),
                "created_at": row.get("created_at")
                or datetime.now(timezone.utc).isoformat(),
            }
            trades.append(TradeRecord.model_validate(mapped))
        return trades

    def _get_depths(
        self, trades: List[TradeRecord], securities: List[Security]
    ) -> Dict[str, float]:
        depths = {security.id: 0.0 for security in securities}
        for trade in trades:
            if trade.security_id in depths:
                depths[trade.security_id] += abs(trade.quantity)
        return depths

    def _get_quantities(
        self, trades: List[TradeRecord], securities: List[Security]
    ) -> Dict[str, float]:
        quantities = {security.id: 0.0 for security in securities}
        for trade in trades:
            if trade.security_id in quantities:
                quantities[trade.security_id] += trade.quantity
        return quantities

    def _get_total_volume(self, trades: List[TradeRecord]) -> float:
        return sum(abs(trade.price_cents) for trade in trades)

    def _get_open_interest(self, trades: List[TradeRecord]) -> float:
        return sum(abs(trade.quantity) for trade in trades)

    def _generate_settlement_dates(
        self, resolution_date: datetime
    ) -> List[Dict[str, str]]:
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

    def _create_securities(self, market_id: str, outcomes: List[str]) -> None:
        for outcome in outcomes:
            record = {"market_id": market_id, "outcome": outcome}
            response = self.supabase.table("securities").insert(record).execute()
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create security",
                )

    def _get_market_securities(self, market_id: str) -> List[Security]:
        securities = []
        response = (
            self.supabase.table("securities")
            .select("*")
            .eq("market_id", market_id)
            .execute()
        )
        rows = response.data or []
        for row in rows:
            mapped = {
                "id": row.get("id"),
                "market_id": market_id,
                "outcome": row.get("outcome"),
                "created_at": row.get("created_at")
                or datetime.now(timezone.utc).isoformat(),
            }
            securities.append(Security.model_validate(mapped))
        return securities

    def get_security(self, security_id: str) -> Security:
        response = (
            self.supabase.table("securities")
            .select("*")
            .eq("id", security_id)
            .single()
            .execute()
        )
        record = response.data
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Security not found"
            )

        mapped = {
            "id": security_id,
            "market_id": record.get("market_id"),
            "outcome": record.get("outcome"),
            "created_at": record.get("created_at")
            or datetime.now(timezone.utc).isoformat(),
        }
        return Security.model_validate(mapped)
