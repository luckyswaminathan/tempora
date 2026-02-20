"""Trading history and probability tracking service."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from core import models
from schemas.history import ProbabilityHistData, ProbabilityHistResponse
from services.markets import MarketService
from utils.pricing import calculate_implied_probability


class HistoryService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(session)

    def get_probability_history(self, security_id: str) -> ProbabilityHistResponse:
        """Get the historical probability chart for a security."""
        security = self.market_service.get_security(security_id)
        market = self.market_service.get_market(security.market_id)

        stmt = (
            select(models.Trade)
            .join(models.Security)
            .where(models.Security.market_id == market.id)
            .order_by(models.Trade.created_at)
        )
        trades = self.session.scalars(stmt).all()

        quantities_map = {quote.security_id: 0 for quote in market.quotes}

        # Initial probability
        probability = calculate_implied_probability(
            quantities_map, security_id, market.liquidity_parameter
        )
        history = [
            ProbabilityHistData.model_validate(
                {"probability": probability, "date": market.created_at}
            )
        ]

        # Trading history - record probability after each order completes
        for i, trade in enumerate(trades):
            quantities_map[trade.security_id] += trade.quantity

            # Only record probability after the entire order completes
            if i == len(trades) - 1 or trade.order_id != trades[i + 1].order_id:
                probability = calculate_implied_probability(
                    quantities_map, security_id, market.liquidity_parameter
                )
                history.append(
                    ProbabilityHistData.model_validate(
                        {"probability": probability, "date": trade.created_at}
                    )
                )

        # Current probability
        history.append(
            ProbabilityHistData.model_validate(
                {
                    "probability": probability,
                    "date": datetime.now(timezone.utc).isoformat(),
                }
            )
        )

        # TODO: if market status == "resolved", then add prob at resolution time instead
        # TODO: save historical implied probabilities in table to avoid recalculation

        return ProbabilityHistResponse.model_validate({"history": history})
