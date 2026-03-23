from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from urllib.parse import quote

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from core import models
from core.config import settings
from utils.email import send_notification_email
from utils.settlement import compute_settlement_totals


class NotificationService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_notification(
        self,
        *,
        user_id: str,
        event_type: models.NotificationType,
        title: str,
        body: str,
        payload: dict | None = None,
    ) -> models.Notification:
        notification = models.Notification(
            user_id=user_id,
            event_type=event_type,
            title=title,
            body=body,
            payload=payload or {},
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(notification)

        profile = self.session.get(models.Profile, user_id)
        user = profile.user if profile else None
        if profile and user and profile.email_notifications_enabled and user.email:
            market_id = (payload or {}).get("marketId")
            market_url = (
                f"{settings.frontend_base_url.rstrip('/')}/market/{quote(str(market_id))}"
                if market_id
                else f"{settings.frontend_base_url.rstrip('/')}/notifications"
            )
            send_notification_email(
                recipient_email=user.email,
                subject=f"Tempora: {title}",
                plain_text_body=(
                    f"{title}\n\n" f"{body}\n\n" f"View details: {market_url}\n"
                ),
            )

        return notification

    def create_bulk_notifications(
        self,
        *,
        user_ids: list[str],
        event_type: models.NotificationType,
        title: str,
        body: str,
        payload: dict | None = None,
    ) -> None:
        if not user_ids:
            return
        for user_id in user_ids:
            self.create_notification(
                user_id=user_id,
                event_type=event_type,
                title=title,
                body=body,
                payload=payload,
            )

    def list_notifications(
        self,
        *,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
    ) -> tuple[list[models.Notification], int]:
        normalized_limit = max(1, min(limit, 200))
        stmt = select(models.Notification).where(models.Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(models.Notification.is_read.is_(False))
        stmt = stmt.order_by(models.Notification.created_at.desc()).limit(
            normalized_limit
        )

        notifications = self.session.scalars(stmt).all()
        unread_count = self.get_unread_count(user_id)
        return notifications, unread_count

    def get_unread_count(self, user_id: str) -> int:
        unread_stmt = (
            select(func.count())
            .select_from(models.Notification)
            .where(
                models.Notification.user_id == user_id,
                models.Notification.is_read.is_(False),
            )
        )
        return int(self.session.scalar(unread_stmt) or 0)

    def mark_read(
        self, *, user_id: str, notification_id: str
    ) -> models.Notification | None:
        notification = self.session.get(models.Notification, notification_id)
        if not notification or notification.user_id != user_id:
            return None

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            self.session.commit()
            self.session.refresh(notification)
        return notification

    def mark_all_read(self, *, user_id: str) -> int:
        now = datetime.now(timezone.utc)
        stmt = (
            update(models.Notification)
            .where(
                models.Notification.user_id == user_id,
                models.Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        result = self.session.execute(stmt)
        self.session.commit()
        return int(result.rowcount or 0)

    def notify_limit_order_filled(
        self,
        *,
        order: models.Order,
        total_cost_cents: int,
        market_question: str,
    ) -> None:
        legs = order.legs or []
        gross_shares = sum(abs(int(leg.get("quantity", 0))) for leg in legs)
        leg_count = len(legs)
        avg_unit_price_cents = (
            int(total_cost_cents / gross_shares) if gross_shares else 0
        )

        self.create_notification(
            user_id=order.user_id,
            event_type=models.NotificationType.LIMIT_ORDER_FILLED,
            title="Your limit order was filled",
            body=f"{market_question}: {gross_shares} share(s) executed across {leg_count} leg(s).",
            payload={
                "orderId": order.id,
                "marketId": order.market_id,
                "marketQuestion": market_question,
                "totalCostCents": total_cost_cents,
                "grossShares": gross_shares,
                "legCount": leg_count,
                "avgUnitPriceCents": avg_unit_price_cents,
            },
        )

    def notify_market_settlement_for_positions(
        self,
        *,
        market: models.Market,
        winning_security: models.Security,
        trades: list[models.Trade],
    ) -> None:
        by_user_security = defaultdict(
            lambda: defaultdict(lambda: {"quantity": 0, "cost_basis": 0})
        )
        for trade in trades:
            metrics = by_user_security[trade.user_id][trade.security_id]
            metrics["quantity"] += trade.quantity or 0
            metrics["cost_basis"] += trade.price_cents or 0

        for user_id, metrics_by_security in by_user_security.items():
            position_count, total_cost_cents, total_payout_cents = (
                compute_settlement_totals(
                    dict(metrics_by_security),
                    market.winning_security_id,
                )
            )
            if position_count == 0:
                continue

            total_pnl_cents = total_payout_cents - total_cost_cents
            self.create_notification(
                user_id=user_id,
                event_type=models.NotificationType.POSITION_MARKET_SETTLED,
                title="Market you traded has settled",
                body=f"{market.question} resolved to '{winning_security.outcome}'.",
                payload={
                    "marketId": market.id,
                    "marketQuestion": market.question,
                    "winningSecurityId": winning_security.id,
                    "winningOutcome": winning_security.outcome,
                    "positionCount": position_count,
                    "totalCostCents": total_cost_cents,
                    "totalPayoutCents": total_payout_cents,
                    "totalPnlCents": total_pnl_cents,
                },
            )

    def notify_market_maker_market_settled(
        self,
        *,
        market: models.Market,
        winning_security: models.Security,
        total_revenue_cents: int,
        total_payout_cents: int,
    ) -> None:
        self.create_notification(
            user_id=market.creator_id,
            event_type=models.NotificationType.MARKET_MAKER_MARKET_SETTLED,
            title="Your market has settled",
            body=f"{market.question} settled to '{winning_security.outcome}'.",
            payload={
                "marketId": market.id,
                "marketQuestion": market.question,
                "winningSecurityId": winning_security.id,
                "winningOutcome": winning_security.outcome,
                "totalRevenueCents": total_revenue_cents,
                "totalPayoutCents": total_payout_cents,
                "netPnlCents": total_revenue_cents - total_payout_cents,
            },
        )

    def notify_market_maker_market_status_updated(
        self,
        *,
        market: models.Market,
        previous_status: str,
        new_status: str,
    ) -> None:
        """Notify market maker of any market status change."""
        # Determine the reason for the status change
        if new_status == str(models.MarketStatus.CLOSED) and previous_status == str(
            models.MarketStatus.OPEN
        ):
            reason = "by an admin or automatic closure due to resolution date"
        else:
            reason = "by an admin"

        self.create_notification(
            user_id=market.creator_id,
            event_type=models.NotificationType.MARKET_MAKER_MARKET_STATUS_UPDATED,
            title="Your market status changed",
            body=f"{market.question} was changed from {previous_status} to {new_status} {reason}.",
            payload={
                "marketId": market.id,
                "marketQuestion": market.question,
                "previousStatus": previous_status,
                "newStatus": new_status,
            },
        )

    def notify_limit_order_expired(
        self,
        *,
        order: models.Order,
        market_question: str,
    ) -> None:
        """Notify user when their limit order expires without being filled."""
        legs = order.legs or []
        gross_shares = sum(abs(int(leg.get("quantity", 0))) for leg in legs)
        leg_count = len(legs)

        self.create_notification(
            user_id=order.user_id,
            event_type=models.NotificationType.LIMIT_ORDER_EXPIRED,
            title="Your limit order has expired",
            body=(
                f"{market_question}: Your order for {gross_shares} share(s) "
                f"across {leg_count} leg(s) was not filled and has expired."
            ),
            payload={
                "orderId": order.id,
                "marketId": order.market_id,
                "marketQuestion": market_question,
                "grossShares": gross_shares,
                "legCount": leg_count,
            },
        )
