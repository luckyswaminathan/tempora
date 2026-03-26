from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import case, select, update
from sqlalchemy.orm import Session, selectinload

from core import models
from schemas.market import (
    MarketListResponse,
    MarketUpdate,
    MarketSettlement,
    MarketSettlementResponse,
    Market,
    Security,
    OutcomeWithValue,
    MarketMakerMarket,
    MarketMakerDashboard,
    SettlementInfo,
    SettlementUserTotals,
)
from utils.pricing import calculate_market_quotes
from utils.settlement import (
    aggregate_position_metrics,
    compute_settlement_totals,
    summarize_market_settlement,
)
from services.notifications import NotificationService


class MarketService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.notification_service = NotificationService(session)

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

    def create_market(
        self,
        proposal: models.MarketProposal,
        creator_id: str,
        initial_funding_cents: int,
    ) -> models.Market:
        """
        Create a market from an approved proposal.
        This should only be called from the proposal publish flow.
        """
        market = models.Market(
            question=proposal.question,
            category=proposal.category,
            description=proposal.description,
            resolution_date=proposal.resolution_date,
            status=models.MarketStatus.OPEN,
            tags=proposal.tags,
            liquidity_parameter=proposal.liquidity_parameter,
            ui_type=proposal.ui_type,
            creator_id=creator_id,
            initial_funding_cents=initial_funding_cents,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.session.add(market)
        self.session.flush()

        # Convert outcomes from JSON dicts to OutcomeWithValue objects
        outcomes = [
            OutcomeWithValue(**o) if isinstance(o, dict) else o
            for o in proposal.outcomes
        ]
        self._create_securities(market.id, outcomes)
        self.session.commit()
        self.session.refresh(market)
        return market

    def update_market(self, market_id: str, payload: MarketUpdate) -> Market:
        market = self.session.get(models.Market, market_id)
        if not market:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Market not found"
            )

        if market.status == models.MarketStatus.RESOLVED:
            raise HTTPException(
                status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
                detail="Cannot update a resolved market",
            )

        previous_status = str(market.status)

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

        if payload.securities is not None:
            for update in payload.securities:
                security = self.session.get(models.Security, update.id)
                if security:
                    security.outcome = update.outcome

        if payload.status is not None and str(payload.status) != previous_status:
            self.notification_service.notify_market_maker_market_status_updated(
                market=market,
                previous_status=previous_status,
                new_status=str(payload.status),
            )

        self.session.commit()
        self.session.refresh(market)
        return self._attach_quote(market)

    def settle_market(self, payload: MarketSettlement) -> MarketSettlementResponse:
        security = self.session.get(models.Security, payload.winning_security_id)
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

        # Load all market trades once, then derive both revenue and winner payouts.
        all_market_trades_stmt = (
            select(models.Trade)
            .join(models.Security)
            .where(models.Security.market_id == market.id)
        )
        all_market_trades = self.session.scalars(all_market_trades_stmt).all()

        summary = summarize_market_settlement(
            all_market_trades,
            payload.winning_security_id,
        )

        user_pnl = summary.user_payouts_cents
        total_payout = summary.total_payout_cents
        revenue = summary.total_revenue_cents

        creator_profile = self.session.get(models.Profile, market.creator_id)
        if not creator_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Market creator profile not found",
            )

        # Verify net loss is within initial funding (should be impossible with correct LMSR)
        # initial_funding = b*ln(N) = max possible net loss = max(payout - revenue)
        net_loss = max(0, int(total_payout) - revenue)
        if net_loss > market.initial_funding_cents:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"CRITICAL ERROR: Settlement net loss (${net_loss/100:.2f}) exceeds initial funding (${market.initial_funding_cents/100:.2f}). This should be impossible with LMSR.",
            )

        if total_payout > 0:
            # Check if market maker has sufficient funds to cover the gross payout.
            # The wallet already includes all revenue collected from trades.
            if creator_profile.wallet < int(total_payout):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"CRITICAL ERROR: Market maker has insufficient funds. Required: ${total_payout/100:.2f}, Available: ${creator_profile.wallet/100:.2f}",
                )

            # Deduct the gross payout from market maker's wallet
            creator_profile.wallet -= int(total_payout)

        # Pay out winners
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

        # Cancel all outstanding unfilled limit orders for this market
        cancel_stmt = (
            update(models.Order)
            .where(
                models.Order.market_id == market.id,
                models.Order.type == models.OrderType.LIMIT,
                models.Order.filled.is_(False),
                models.Order.canceled.is_(False),
            )
            .values(canceled=True)
        )
        self.session.execute(cancel_stmt)

        market.status = models.MarketStatus.RESOLVED
        market.winning_security_id = payload.winning_security_id

        self.notification_service.notify_market_settlement_for_positions(
            market=market,
            winning_security=security,
            trades=all_market_trades,
        )

        self.notification_service.notify_market_maker_market_settled(
            market=market,
            winning_security=security,
            total_revenue_cents=revenue,
            total_payout_cents=int(total_payout),
        )

        self.session.commit()
        self.session.refresh(market)

        return MarketSettlementResponse.model_validate(
            {
                "id": market.id,
                "winning_outcome": security.outcome,
                "net_payout": total_payout,
            }
        )

    def get_settlement_info(
        self, market_id: str, user_id: Optional[str] = None
    ) -> SettlementInfo:
        """Get settlement info for a resolved market, optionally including user position and payout distribution."""

        market = self.session.get(models.Market, market_id)
        if not market:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Market not found"
            )

        if market.status != models.MarketStatus.RESOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Market is not resolved",
            )

        winning_security = self.session.get(models.Security, market.winning_security_id)
        if not winning_security:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Winning security not found",
            )

        user_totals = None
        if user_id:
            # Get user's trades in this market
            trades_stmt = (
                select(models.Trade)
                .join(models.Security)
                .where(
                    models.Trade.user_id == user_id,
                    models.Security.market_id == market_id,
                )
            )
            trades = self.session.scalars(trades_stmt).all()

            if trades:
                positions_by_security = aggregate_position_metrics(
                    trades,
                    lambda trade: trade.security_id,
                )

                position_count, total_cost_cents, total_payout_cents = (
                    compute_settlement_totals(
                        positions_by_security,
                        market.winning_security_id,
                    )
                )

                user_totals = SettlementUserTotals.model_validate(
                    {
                        "positionCount": position_count,
                        "totalCostCents": total_cost_cents,
                        "totalPayoutCents": total_payout_cents,
                        "totalPnlCents": total_payout_cents - total_cost_cents,
                    }
                )

        # Include payout distribution if requesting user is the market maker
        payout_distribution = None
        market_total_revenue_cents = None
        market_total_payout_cents = None
        market_net_pnl_cents = None
        if user_id == market.creator_id:
            all_market_trades_stmt = (
                select(models.Trade)
                .join(models.Security)
                .where(models.Security.market_id == market.id)
            )
            all_market_trades = self.session.scalars(all_market_trades_stmt).all()

            summary = summarize_market_settlement(
                all_market_trades,
                market.winning_security_id,
            )

            market_total_revenue_cents = summary.total_revenue_cents
            market_total_payout_cents = summary.total_payout_cents
            market_net_pnl_cents = (
                summary.total_revenue_cents - summary.total_payout_cents
            )

            payout_distribution = [
                {"userId": user_id, "payoutCents": payout_cents}
                for user_id, payout_cents in sorted(
                    (
                        (uid, cents)
                        for uid, cents in summary.user_payouts_cents.items()
                        if cents != 0
                    ),
                    key=lambda x: x[1],
                    reverse=True,
                )
            ]

        return SettlementInfo.model_validate(
            {
                "market_id": market_id,
                "winning_security_id": market.winning_security_id,
                "winning_outcome": winning_security.outcome,
                "settlement_date": market.updated_at,
                "user_totals": user_totals,
                "payout_distribution": payout_distribution,
                "market_total_revenue_cents": market_total_revenue_cents,
                "market_total_payout_cents": market_total_payout_cents,
                "market_net_pnl_cents": market_net_pnl_cents,
            }
        )

    def _attach_quote(self, market: models.Market) -> Market:
        securities = [
            Security.model_validate(
                {
                    "id": s.id,
                    "market_id": market.id,
                    "outcome": s.outcome,
                    "value": s.value,
                    "is_catch_all": s.is_catch_all,
                    "created_at": s.created_at or datetime.now(timezone.utc),
                }
            )
            for s in market.securities
        ]

        # Sort securities by value (ascending)
        securities.sort(key=lambda s: s.value)

        # Get trades for this market
        trades_stmt = (
            select(models.Trade)
            .join(models.Security)
            .where(models.Security.market_id == market.id)
        )
        trades = self.session.scalars(trades_stmt).all()

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
                "uiType": market.ui_type,
                "creatorId": market.creator_id,
                "winningSecurityId": market.winning_security_id,
                "quotes": quotes,
                "securities": securities,
                "openInterest": open_interest,
                "totalVolume": total_volume,
                "liquidityParameter": market.liquidity_parameter,
            }
        )

    def _create_securities(
        self, market_id: str, outcomes: List[OutcomeWithValue]
    ) -> None:
        # Validate: at most one outcome can be marked as catch-all
        catch_all_count = sum(1 for o in outcomes if o.is_catch_all)
        if catch_all_count > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At most one outcome can be marked as catch-all",
            )

        # Validate: either all outcomes have values or none do
        values_provided = [o.value is not None for o in outcomes]
        has_values = any(values_provided)
        all_values = all(values_provided)

        if has_values and not all_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either all outcomes must have values or none should have values",
            )

        # If no values provided, auto-assign sequential values
        if not has_values:
            i = 1
            for outcome in outcomes:
                if outcome.is_catch_all:
                    outcome.value = 1e9
                else:
                    outcome.value = float(i)
                    i += 1

        # Create security records
        for outcome_data in outcomes:
            record = models.Security(
                market_id=market_id,
                outcome=outcome_data.outcome,
                value=outcome_data.value,
                is_catch_all=outcome_data.is_catch_all,
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
                "value": record.value,
                "is_catch_all": record.is_catch_all,
                "created_at": record.created_at
                or datetime.now(timezone.utc).isoformat(),
            }
        )

    def get_market_maker_dashboard(self, creator_id: str) -> MarketMakerDashboard:
        """Get dashboard data for a market maker showing their markets and P&L."""
        # Get all markets created by this user
        stmt = (
            select(models.Market)
            .where(models.Market.creator_id == creator_id)
            .options(
                selectinload(models.Market.securities),
            )
            .order_by(models.Market.created_at.desc())
        )
        markets = self.session.scalars(stmt).all()

        market_data = []
        total_initial_funding = 0
        total_revenue = 0
        total_liability = 0
        total_net_pnl = 0

        for market in markets:
            # Get all trades for this market
            trades_stmt = (
                select(models.Trade)
                .join(models.Security)
                .where(models.Security.market_id == market.id)
            )
            market_trades = self.session.scalars(trades_stmt).all()

            # Calculate revenue from trades (sum of all trade prices)
            revenue = sum(t.price_cents for t in market_trades)

            # Calculate net P&L (for resolved markets) and liability (for unresolved markets)
            net_pnl, liability = 0, 0
            if market.status == models.MarketStatus.RESOLVED:
                winning_payout = 0
                for t in market_trades:
                    if t.security_id == market.winning_security_id:
                        winning_payout += t.quantity * 100
                net_pnl = revenue - winning_payout
            else:
                for security in market.securities:
                    security_quantity = sum(
                        t.quantity
                        for t in market_trades
                        if t.security_id == security.id
                    )
                    # Each share pays out 100 cents if it wins
                    liability = max(liability, security_quantity * 100)

            market_data.append(
                MarketMakerMarket(
                    id=market.id,
                    question=market.question,
                    category=market.category,
                    status=market.status,
                    resolutionDate=market.resolution_date,
                    createdAt=market.created_at,
                    initialFundingCents=market.initial_funding_cents or 0,
                    revenueCents=revenue,
                    liabilityCents=liability,
                    netPnlCents=net_pnl,
                    numTrades=len(market_trades),
                    winningSecurityId=market.winning_security_id,
                )
            )

            total_initial_funding += market.initial_funding_cents or 0
            total_revenue += revenue
            total_liability += liability
            total_net_pnl += net_pnl

        return MarketMakerDashboard(
            markets=market_data,
            totalInitialFundingCents=total_initial_funding,
            totalRevenueCents=total_revenue,
            totalLiabilityCents=total_liability,
            totalNetPnlCents=total_net_pnl,
        )

    def close_overdue_markets_and_notify_admins(self) -> int:
        """Close open markets past resolution date and notify admins to settle."""
        now = datetime.now(timezone.utc)
        overdue_stmt = select(models.Market).where(
            models.Market.status == models.MarketStatus.OPEN,
            models.Market.resolution_date <= now,
        )
        overdue_markets = self.session.scalars(overdue_stmt).all()
        if not overdue_markets:
            return 0

        admin_stmt = select(models.User).where(
            models.User.role == models.UserRole.ADMIN
        )
        admin_users = self.session.scalars(admin_stmt).all()
        admin_ids = [admin.id for admin in admin_users]

        for market in overdue_markets:
            previous_status = str(market.status)
            market.status = models.MarketStatus.CLOSED
            market.updated_at = now

            # Notify market maker of auto-closure
            self.notification_service.notify_market_maker_market_status_updated(
                market=market,
                previous_status=previous_status,
                new_status=str(models.MarketStatus.CLOSED),
            )

            if admin_ids:
                self.notification_service.create_bulk_notifications(
                    user_ids=admin_ids,
                    event_type=models.NotificationType.ADMIN_MARKET_OVERDUE_CLOSED,
                    title="Market closed after resolution deadline",
                    body=f"{market.question} reached its resolution date and was closed automatically.",
                    payload={
                        "marketId": market.id,
                        "marketQuestion": market.question,
                        "resolutionDate": market.resolution_date.isoformat(),
                        "status": market.status,
                        "actionRequired": "Settle market",
                    },
                )

        self.session.commit()
        return len(overdue_markets)
