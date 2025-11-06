from __future__ import annotations

from collections import defaultdict
from typing import Any

from supabase import Client

from schemas.market import MarketWithQuote
from schemas.portfolio import Holding, PortfolioSnapshot, PortfolioSummary
from services.markets import MarketService


class PortfolioService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase
        self.market_service = MarketService(supabase)

    def get_portfolio(self, user_id: str) -> PortfolioSnapshot:
        trades = (
            self.supabase.table("trades")
            .select("market_id, side, shares, price_cents, stake")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )

        grouped = defaultdict(lambda: {"shares": 0.0, "stake": 0.0})
        for trade in trades:
            key = (trade["market_id"], trade["side"])
            grouped[key]["shares"] += trade.get("shares", 0.0)
            grouped[key]["stake"] += trade.get("stake", 0.0)

        holdings = []
        cost_basis = 0.0
        market_value = 0.0

        for (market_id, side), metrics in grouped.items():
            market = self.market_service.get_market(market_id)
            mark_price = self._mark_price_for_side(market, side)
            quantity = metrics["shares"]
            if quantity:
                avg_price = (metrics["stake"] / quantity) * 100
            else:
                avg_price = mark_price

            cost_basis += avg_price * quantity / 100
            mark_value_dollars = mark_price * quantity / 100
            market_value += mark_value_dollars
            pnl = mark_value_dollars - (avg_price * quantity / 100)

            holdings.append(
                Holding.model_validate(
                    {
                        "marketId": market_id,
                        "question": market.question,
                        "outcome": side,
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

    def _mark_price_for_side(self, market: MarketWithQuote, side: str) -> float:
        if side == "YES":
            return market.quote.yes_price_cents
        return market.quote.no_price_cents
