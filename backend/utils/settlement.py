from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Callable, Hashable, Iterable, TypeVar

from core import models

KeyType = TypeVar("KeyType", bound=Hashable)


@dataclass(frozen=True)
class PositionSettlement:
    quantity: int
    cost_basis_cents: int
    payout_cents: int
    pnl_cents: int


@dataclass(frozen=True)
class MarketSettlementSummary:
    user_payouts_cents: dict[str, int]
    total_payout_cents: int
    total_revenue_cents: int


def aggregate_position_metrics(
    trades: Iterable[models.Trade],
    key_fn: Callable[[models.Trade], KeyType],
) -> dict[KeyType, dict[str, int]]:
    metrics = defaultdict(lambda: {"quantity": 0, "cost_basis": 0})
    for trade in trades:
        key = key_fn(trade)
        metrics[key]["quantity"] += trade.quantity or 0
        metrics[key]["cost_basis"] += trade.price_cents or 0
    return dict(metrics)


def compute_position_settlement(
    *,
    quantity: int,
    cost_basis_cents: int,
    is_winning_security: bool,
) -> PositionSettlement:
    payout_cents = quantity * 100 if is_winning_security else 0
    pnl_cents = payout_cents - cost_basis_cents
    return PositionSettlement(
        quantity=quantity,
        cost_basis_cents=cost_basis_cents,
        payout_cents=payout_cents,
        pnl_cents=pnl_cents,
    )


def compute_settlement_totals(
    position_metrics: dict[str, dict[str, int]],
    winning_security_id: str | None,
) -> tuple[int, int, int]:
    position_count = 0
    total_cost_cents = 0
    total_payout_cents = 0

    for security_id, data in position_metrics.items():
        quantity = data["quantity"]
        if quantity == 0:
            continue

        position = compute_position_settlement(
            quantity=quantity,
            cost_basis_cents=data["cost_basis"],
            is_winning_security=security_id == winning_security_id,
        )
        position_count += 1
        total_cost_cents += position.cost_basis_cents
        total_payout_cents += position.payout_cents

    return position_count, total_cost_cents, total_payout_cents


def summarize_market_settlement(
    trades: Iterable[models.Trade],
    winning_security_id: str,
) -> MarketSettlementSummary:
    user_payouts_cents = defaultdict(int)
    total_revenue_cents = 0

    for trade in trades:
        total_revenue_cents += trade.price_cents
        if trade.security_id == winning_security_id:
            user_payouts_cents[trade.user_id] += trade.quantity * 100

    payouts = dict(user_payouts_cents)
    return MarketSettlementSummary(
        user_payouts_cents=payouts,
        total_payout_cents=sum(payouts.values()),
        total_revenue_cents=total_revenue_cents,
    )
