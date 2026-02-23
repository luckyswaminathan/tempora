from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from core import models
from schemas.portfolio import (
    Holding,
    PortfolioSnapshot,
    PortfolioSummary,
    CollateralBreakdown,
    MarketShortCollateral,
    ShortPosition,
    LimitOrderCollateral,
    MarketMakerCollateral,
)
from services.markets import MarketService
from utils.collateral import (
    get_user_collateral_locked,
    get_short_positions_data,
    get_limit_orders_data,
    get_market_maker_markets_data,
)


class PortfolioService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(session)

    def get_portfolio(self, user_id: str) -> PortfolioSnapshot:
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        stmt = (
            select(models.Trade)
            .join(models.Security)
            .join(models.Market, models.Security.market_id == models.Market.id)
            .where(
                models.Trade.user_id == user_id,
                models.Market.status != models.MarketStatus.RESOLVED,
            )
        )
        open_trades = self.session.scalars(stmt).all()

        metrics_by_security = defaultdict(lambda: {"quantity": 0, "cost_basis": 0})
        for trade in open_trades:
            key = (trade.security.market_id, trade.security_id)
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
                        "category": market.category,
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
        collateral_locked = get_user_collateral_locked(self.session, user_id)
        spendable_balance = max(0, profile.wallet - collateral_locked)

        return PortfolioSnapshot(
            wallet=profile.wallet,
            spendable_balance=spendable_balance,
            collateral_locked=collateral_locked,
            holdings=holdings,
            summary=summary,
        )

    def get_collateral_breakdown(self, user_id: str) -> CollateralBreakdown:
        """Get detailed breakdown of all collateral locked by user."""
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        # 1. Get short position details (grouped by market)
        short_data_by_market = get_short_positions_data(self.session, user_id)
        short_markets = []
        total_short_collateral = 0

        for market_id, (market, positions, collateral) in short_data_by_market.items():
            short_positions_list = [
                ShortPosition(outcome=security.outcome, quantity=quantity)
                for security, quantity in positions
            ]
            short_markets.append(
                MarketShortCollateral(
                    market_id=market_id,
                    question=market.question,
                    positions=short_positions_list,
                    collateral_cents=collateral,
                )
            )
            total_short_collateral += collateral

        # 2. Get limit order details
        unfilled_orders = get_limit_orders_data(self.session, user_id)
        limit_orders = []
        total_limit_order_collateral = 0

        for order in unfilled_orders:
            market = self.market_service.get_market(order.market_id)
            limit_orders.append(
                LimitOrderCollateral(
                    order_id=order.id,
                    market_id=order.market_id,
                    question=market.question,
                    collateral_cents=order.collateral_locked_cents,
                    created_at=order.created_at.isoformat(),
                )
            )
            total_limit_order_collateral += order.collateral_locked_cents

        # 3. Get market maker details — compute revenue per market for adaptive collateral
        from sqlalchemy import select as _select
        from core import models as _models

        user_markets = get_market_maker_markets_data(self.session, user_id)
        market_maker_markets = []
        total_market_maker_collateral = 0

        for market in user_markets:
            if market.initial_funding_cents <= 0:
                continue
            # Compute revenue already collected from trades for this market
            trades_stmt = (
                _select(_models.Trade)
                .join(_models.Security)
                .where(_models.Security.market_id == market.id)
            )
            market_trades = self.session.scalars(trades_stmt).all()
            revenue = sum(t.price_cents for t in market_trades)
            effective = max(0, market.initial_funding_cents + revenue)
            market_maker_markets.append(
                MarketMakerCollateral(
                    market_id=market.id,
                    question=market.question,
                    initial_funding_cents=market.initial_funding_cents,
                    revenue_cents=revenue,
                    effective_collateral_cents=effective,
                    end_date=market.resolution_date.strftime("%b %d, %Y"),
                )
            )
            total_market_maker_collateral += effective

        total_locked = (
            total_short_collateral
            + total_limit_order_collateral
            + total_market_maker_collateral
        )

        return CollateralBreakdown(
            total_locked=total_locked,
            short_markets=short_markets,
            total_short_collateral=total_short_collateral,
            limit_orders=limit_orders,
            total_limit_order_collateral=total_limit_order_collateral,
            market_maker_markets=market_maker_markets,
            total_market_maker_collateral=total_market_maker_collateral,
        )
