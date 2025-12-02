from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.portfolio import Holding, PortfolioSnapshot, PortfolioSummary
from services.markets import MarketService


class PortfolioService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(session)

    def get_portfolio(self, user_id: str) -> PortfolioSnapshot:
        trades = (
            self.session.execute(
                select(
                    models.Trade.market_id,
                    models.Trade.security_id,
                    models.Trade.quantity,
                    models.Trade.price_cents,
                ).where(models.Trade.user_id == user_id)
            ).all()
            or []
        )

        metrics_by_security = defaultdict(lambda: {"quantity": 0, "cost_basis": 0.0})
        for market_id, security_id, quantity, price_cents in trades:
            key = (market_id, security_id)
            metrics_by_security[key]["quantity"] += quantity or 0
            metrics_by_security[key]["cost_basis"] += price_cents or 0.0

        holdings = []
        cost_basis = 0.0
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
                        "avgPriceCents": avg_price,
                        "quantity": quantity,
                        "markPriceCents": mark_price,
                        "endDate": market.resolution_date.strftime("%b %d, %Y"),
                        "pnl": round(pnl, 20),
                    }
                )
            )

        unrealised_pnl = market_value - cost_basis
        roi = (unrealised_pnl / cost_basis * 100) if cost_basis > 0 else 0.0

        summary = PortfolioSummary.model_validate(
            {
                "costBasis": round(cost_basis, 2),
                "marketValue": round(market_value, 2),
                "unrealisedPnL": round(unrealised_pnl, 2),
                "roi": round(roi, 2),
            }
        )

        return PortfolioSnapshot(holdings=holdings, summary=summary)
