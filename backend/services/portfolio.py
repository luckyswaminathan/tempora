from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from core import models
from schemas.portfolio import Holding, PortfolioSnapshot, PortfolioSummary
from services.markets import MarketService
from services.trades import TradeService


class PortfolioService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(session)
        self.trade_service = TradeService(session)

    def get_portfolio(self, user_id: str) -> PortfolioSnapshot:
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        stmt = (
            select(models.Trade)
            .join(models.Market, models.Trade.market_id == models.Market.id)
            .where(
                models.Trade.user_id == user_id,
                models.Market.status != models.MarketStatus.RESOLVED,
            )
        )
        open_trades = self.session.scalars(stmt).all()

        metrics_by_security = defaultdict(lambda: {"quantity": 0, "cost_basis": 0})
        for trade in open_trades:
            key = (trade.market_id, trade.security_id)
            metrics_by_security[key]["quantity"] += trade.quantity or 0
            metrics_by_security[key]["cost_basis"] += trade.price_cents or 0

        holdings = []
        cost_basis = 0
        market_value = 0.0

        for (market_id, security_id), metrics in metrics_by_security.items():
            market = self.market_service.get_market(market_id)
            security = self.market_service.get_security(security_id)

            position_cost = metrics["cost_basis"]
            quantity = metrics["quantity"]

            mark_price = 0.0
            for quote in market.quotes:
                if security_id == quote.security_id:
                    mark_price = 100.0 * quote.implied_probability

            avg_price = mark_price
            if quantity:
                avg_price = position_cost / quantity

            cost_basis += position_cost
            mark_value_cents = mark_price * quantity
            market_value += mark_value_cents
            pnl = mark_value_cents - position_cost

            holdings.append(
                Holding.model_validate(
                    {
                        "marketId": market_id,
                        "securityId": security_id,
                        "question": market.question,
                        "outcome": security.outcome,
                        "avgPriceCents": round(avg_price, 2),
                        "quantity": quantity,
                        "markPriceCents": round(mark_price, 2),
                        "endDate": market.resolution_date.strftime("%b %d, %Y"),
                        "pnl": round(pnl),
                    }
                )
            )

        unrealised_pnl = market_value - cost_basis
        roi = (unrealised_pnl / cost_basis * 100) if cost_basis > 0 else 0.0

        summary = PortfolioSummary.model_validate(
            {
                "costBasis": cost_basis,
                "marketValue": round(market_value, 2),
                "unrealisedPnL": round(unrealised_pnl, 2),
                "roi": round(roi, 2),
            }
        )

        # Calculate collateral locked for short positions
        collateral_locked = self.trade_service._get_user_collateral_locked(user_id)
        spendable_balance = max(0, profile.wallet - collateral_locked)

        return PortfolioSnapshot(
            wallet=profile.wallet,
            spendable_balance=spendable_balance,
            collateral_locked=collateral_locked,
            holdings=holdings,
            summary=summary,
        )
