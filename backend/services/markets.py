from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import case, select, update
from sqlalchemy.orm import Session, selectinload

from core import models
from schemas.market import (
    MarketCreate,
    MarketListResponse,
    MarketUpdate,
    MarketSettlement,
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

        markets = self.session.scalars(
            stmt.options(
                selectinload(models.Market.securities),
                selectinload(models.Market.trades),
            )
        ).all()
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
            status=models.MarketStatus.OPEN,
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
            market.status = payload.status
        if payload.tags is not None:
            market.tags = payload.tags

        self.session.commit()
        self.session.refresh(market)
        return self._attach_quote(market)

    def settle_market(self, payload: MarketSettlement) -> Market:
        security = self.session.get(
            models.Security, security_id=payload.winning_security_id
        )
        if not security:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Winning security not found",
            )

        market = security.market

        if market.status not in [
            models.MarketStatus.OPEN,
            models.MarketStatus.CLOSED,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Market cannot be settled",
            )

        trades = security.trades

        user_pnl = defaultdict(float)
        for trade in trades:
            user_pnl[trade.user_id] += trade.quantity

        if user_pnl:
            case_expr = case(
                {user_id: delta for user_id, delta in user_pnl.items()},
                value=models.Profile.id,
            )

            stmt = (
                update(models.Profile)
                .where(models.Profile.id.in_(user_pnl.keys()))
                .values(wallet=models.Profile.wallet + case_expr)
            )
            self.session.execute(stmt)

        market.status = models.MarketStatus.RESOLVED

        self.session.commit()
        self.session.refresh(market)
        return self._attach_quote(market)

    def _attach_quote(self, market: models.Market) -> Market:
        securities = [
            Security.model_validate(
                {
                    "id": s.id,
                    "market_id": market.id,
                    "outcome": s.outcome,
                    "created_at": s.created_at or datetime.now(timezone.utc),
                }
            )
            for s in market.securities
        ]

        trades = [
            TradeRecord.model_validate(
                {
                    "id": t.id,
                    "user_id": t.user_id,
                    "market_id": t.market_id,
                    "trade_group_id": t.trade_group_id,
                    "security_id": t.security_id,
                    "quantity": t.quantity,
                    "price_cents": t.price_cents,
                    "created_at": t.created_at or datetime.now(timezone.utc),
                }
            )
            for t in market.trades
        ]

        # Compute quantities per security
        quantities = {s.id: 0 for s in securities}
        for t in trades:
            quantities[t.security_id] += t.quantity

        # Compute quotes
        quotes = calculate_market_quotes(quantities, market.liquidity_parameter)

        # Compute total volume, open interest
        user_net_volume = defaultdict(int)
        user_net_interest = defaultdict(int)
        for t in trades:
            user_net_volume[(t.user_id, t.security_id)] += t.price_cents
            user_net_interest[(t.user_id, t.security_id)] += t.quantity
        total_volume = sum(abs(v) for v in user_net_volume.values())
        open_interest = sum(abs(q) for q in user_net_interest.values())

        settlement_dates = [
            self._map_settlement_date(sd) for sd in (market.settlement_dates or [])
        ]

        return Market.model_validate(
            {
                "id": market.id,
                "question": market.question,
                "category": market.category or "General",
                "status": market.status or models.MarketStatus.OPEN,
                "resolutionDate": market.resolution_date,
                "createdAt": market.created_at or datetime.now(timezone.utc),
                "updatedAt": market.updated_at or datetime.now(timezone.utc),
                "description": market.description,
                "tags": market.tags or [],
                "quotes": quotes,
                "securities": securities,
                "openInterest": open_interest,
                "totalVolume": total_volume,
                "liquidity_parameter": market.liquidity_parameter,
                "settlementDates": settlement_dates,
            }
        )

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

    def get_security(self, security_id: str) -> Security:
        record = self.session.get(models.Security, security_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Security not found"
            )

        return Security.model_validate(
            {
                "id": security_id,
                "market_id": record.market_id,
                "outcome": record.outcome,
                "created_at": record.created_at
                or datetime.now(timezone.utc).isoformat(),
            }
        )
