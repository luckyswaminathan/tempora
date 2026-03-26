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

        history_stmt = (
            select(models.ProbabilityHistory)
            .where(models.ProbabilityHistory.security_id == security_id)
            .order_by(models.ProbabilityHistory.created_at)
        )
        snapshots = self.session.scalars(history_stmt).all()

        zero_quantities = {quote.security_id: 0 for quote in market.quotes}
        initial_probability = calculate_implied_probability(
            zero_quantities, security_id, market.liquidity_parameter
        )
        history = [
            ProbabilityHistData.model_validate(
                {"probability": initial_probability, "date": market.created_at}
            )
        ]

        for snapshot in snapshots:
            history.append(
                ProbabilityHistData.model_validate(
                    {"probability": snapshot.probability, "date": snapshot.created_at}
                )
            )

        # For live (open) markets, keep the final point anchored at "now"
        # so the graph can render an up-to-date trailing edge.
        if market.status == models.MarketStatus.OPEN:
            current_probability = (
                snapshots[-1].probability if snapshots else initial_probability
            )
            history.append(
                ProbabilityHistData.model_validate(
                    {
                        "probability": current_probability,
                        "date": datetime.now(timezone.utc).isoformat(),
                    }
                )
            )

        return ProbabilityHistResponse.model_validate({"history": history})

    def record_market_probability_snapshot(
        self,
        *,
        market_id: str,
        order_id: str,
        quantities_map: dict[str, int],
        liquidity_parameter: float,
        captured_at: datetime,
    ) -> None:
        """Persist implied probability for each security after an order executes."""
        security_ids = list(quantities_map.keys())
        for security_id in security_ids:
            probability = calculate_implied_probability(
                quantities_map, security_id, liquidity_parameter
            )
            self.session.add(
                models.ProbabilityHistory(
                    market_id=market_id,
                    security_id=security_id,
                    order_id=order_id,
                    probability=probability,
                    created_at=captured_at,
                )
            )
