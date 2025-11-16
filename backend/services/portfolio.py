from __future__ import annotations

from collections import defaultdict

from supabase import Client

from schemas.portfolio import Holding, PortfolioSnapshot, PortfolioSummary
from services.markets import MarketService


class PortfolioService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self.market_service = MarketService(supabase)

    def get_portfolio(self, user_id: str) -> PortfolioSnapshot:
        trades = (
            self.supabase.table("trades")
            .select("market_id, security_id, quantity, price_cents")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )

        metrics_by_security = defaultdict(lambda: {"quantity": 0, "cost_basis": 0.0})
        for trade in trades:
            key = (trade["market_id"], trade["security_id"])
            metrics_by_security[key]["quantity"] += trade.get("quantity", 0)
            metrics_by_security[key]["cost_basis"] += trade.get("price_cents", 0.0)

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
                    mark_price = quote.implied_probability

            avg_price = mark_price
            if quantity:
                avg_price = (position_cost / quantity) * 100

            cost_basis += position_cost
            mark_value_dollars = mark_price * quantity / 100
            market_value += mark_value_dollars
            pnl = mark_value_dollars - position_cost

            holdings.append(
                Holding.model_validate(
                    {
                        "marketId": market_id,
                        "securityId": security_id,
                        "question": market.question,
                        "outcome": security.outcome,
                        "avgPriceCents": round(avg_price, 2),
                        "quantity": round(quantity, 4),
                        "markPriceCents": round(mark_price, 2),
                        "endDate": market.resolution_date.strftime("%b %d, %Y"),
                        "pnl": round(pnl, 2),
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
