from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
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
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_markets(
        self, *, category: Optional[str] = None, status_filter: Optional[str] = None
    ) -> MarketListResponse:
        stmt = select(models.Market)
        if category:
            stmt = stmt.where(models.Market.category == category)
        if status_filter:
            stmt = stmt.where(models.Market.status == status_filter)
        stmt = stmt.order_by(models.Market.created_at.desc())

        markets = self.session.scalars(stmt).all()
        items = [self._attach_quote(market) for market in markets]
        return MarketListResponse(items=items, count=len(items))

    def get_market(self, market_id: str) -> Market:
        market = self.session.get(models.Market, market_id)
        if not market:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Market not found"
            )
        return self._attach_quote(market)

    def create_market(self, payload: MarketCreate) -> Market:
        market = models.Market(
            question=payload.question,
            category=payload.category,
            description=payload.description,
            resolution_date=payload.resolution_date,
            status=MarketStatus.OPEN.value,
            tags=payload.tags,
            liquidity_parameter=payload.liquidity_parameter,
            settlement_dates=self._generate_settlement_dates(payload.resolution_date),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.session.add(market)
        self.session.flush()
        self._create_securities(market.id, payload.outcomes)
        self.session.commit()
        self.session.refresh(market)
        return self._attach_quote(market)

    def update_market(self, market_id: str, payload: MarketUpdate) -> Market:
        market = self.session.get(models.Market, market_id)
        if not market:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Market not found"
            )

        if payload.question is not None:
            market.question = payload.question
        if payload.category is not None:
            market.category = payload.category
        if payload.description is not None:
            market.description = payload.description
        if payload.resolution_date is not None:
            market.resolution_date = payload.resolution_date
        if payload.status is not None:
            market.status = (
                payload.status.value
                if isinstance(payload.status, MarketStatus)
                else payload.status
            )
        if payload.tags is not None:
            market.tags = payload.tags
        market.updated_at = datetime.now(timezone.utc)

        self.session.commit()
        self.session.refresh(market)
        return self._attach_quote(market)

    def _attach_quote(self, record: models.Market) -> Market:
        trades = self._get_trades(record.id)
        securities = self._get_market_securities(record.id)
        quantities = self._get_quantities(trades, securities)
        quotes = calculate_market_quotes(quantities, record.liquidity_parameter)
        total_volume = self._get_total_volume(trades)
        open_interest = self._get_open_interest(trades)

        settlement_dates = [
            self._map_settlement_date(entry)
            for entry in (record.settlement_dates or [])
        ]

        mapped = {
            "id": record.id,
            "question": record.question,
            "category": record.category or "General",
            "status": record.status or MarketStatus.OPEN.value,
            "resolutionDate": record.resolution_date,
            "createdAt": record.created_at or datetime.now(timezone.utc),
            "updatedAt": record.updated_at or datetime.now(timezone.utc),
            "description": record.description,
            "tags": record.tags or [],
            "quotes": quotes,
            "securities": securities,
            "openInterest": round(open_interest, 2),
            "totalVolume": round(total_volume, 2),
            "liquidity_parameter": record.liquidity_parameter,
            "settlementDates": settlement_dates,
        }
        return Market.model_validate(mapped)

    def _get_trades(self, market_id: str) -> List[TradeRecord]:
        trades = []
        stmt = select(models.Trade).where(models.Trade.market_id == market_id)
        rows = self.session.scalars(stmt).all()
        for row in rows:
            mapped = {
                "id": row.id,
                "user_id": row.user_id,
                "market_id": market_id,
                "trade_group_id": row.trade_group_id,
                "security_id": row.security_id,
                "quantity": row.quantity,
                "price_cents": row.price_cents,
                "created_at": row.created_at or datetime.now(timezone.utc),
            }
            trades.append(TradeRecord.model_validate(mapped))
        return trades

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
            record = models.Security(
                market_id=market_id,
                outcome=outcome,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(record)

    def _get_market_securities(self, market_id: str) -> List[Security]:
        securities = []
        stmt = select(models.Security).where(models.Security.market_id == market_id)
        rows = self.session.scalars(stmt).all()
        for row in rows:
            mapped = {
                "id": row.id,
                "market_id": market_id,
                "outcome": row.outcome,
                "created_at": row.created_at or datetime.now(timezone.utc),
            }
            securities.append(Security.model_validate(mapped))
        return securities

    def get_security(self, security_id: str) -> Security:
        record = self.session.get(models.Security, security_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Security not found"
            )

        mapped = {
            "id": security_id,
            "market_id": record.market_id,
            "outcome": record.outcome,
            "created_at": record.created_at or datetime.now(timezone.utc).isoformat(),
        }
        return Security.model_validate(mapped)
