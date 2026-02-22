from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from core import models
from core.config import settings


def get_current_time(session: Session) -> datetime:
    """Get the platform's current simulated time."""
    state = session.query(models.PlatformState).first()
    if state is None:
        state = models.PlatformState(id=1, current_time=datetime.now(timezone.utc))
        session.add(state)
        session.commit()
        session.refresh(state)
    return state.current_time


def set_current_time(session: Session, new_time: datetime) -> datetime:
    """Set the platform's current time to an absolute value."""
    if new_time.tzinfo is None:
        new_time = new_time.replace(tzinfo=timezone.utc)

    state = session.query(models.PlatformState).first()
    if state is None:
        state = models.PlatformState(id=1, current_time=new_time)
        session.add(state)
    else:
        state.current_time = new_time

    session.commit()
    session.refresh(state)

    check_and_close_markets(session)

    return state.current_time


def advance_time(
    session: Session, *, hours: int = 0, days: int = 0, minutes: int = 0
) -> datetime:
    """Advance the platform's current time by a delta."""
    current = get_current_time(session)
    new_time = current + timedelta(hours=hours, days=days, minutes=minutes)
    return set_current_time(session, new_time)


def check_and_close_markets(session: Session) -> List[models.SettlementTodo]:
    """
    Check for markets past their resolution_date and close them.
    Creates SettlementTodo entries for market makers.
    Returns list of newly created todos.
    """
    current_time = get_current_time(session)
    deadline_delta = timedelta(hours=settings.settlement_deadline_hours)

    open_markets_past_resolution = (
        session.query(models.Market)
        .filter(
            models.Market.status == models.MarketStatus.OPEN,
            models.Market.resolution_date <= current_time,
        )
        .all()
    )

    created_todos = []

    for market in open_markets_past_resolution:
        market.status = models.MarketStatus.CLOSED

        existing_todo = (
            session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id == market.id)
            .first()
        )

        if existing_todo is None:
            todo = models.SettlementTodo(
                market_id=market.id,
                market_maker_id=market.creator_id,
                created_at=current_time,
                deadline=market.resolution_date + deadline_delta,
            )
            session.add(todo)
            created_todos.append(todo)

    session.commit()
    return created_todos


def get_settlement_todos_for_user(
    session: Session, user_id: str, *, include_settled: bool = False
) -> List[models.SettlementTodo]:
    """Get settlement todos for a specific market maker."""
    query = session.query(models.SettlementTodo).filter(
        models.SettlementTodo.market_maker_id == user_id
    )

    if not include_settled:
        query = query.filter(models.SettlementTodo.settled_at.is_(None))

    return query.order_by(models.SettlementTodo.deadline.asc()).all()


def mark_todo_settled(session: Session, market_id: str) -> models.SettlementTodo | None:
    """Mark a settlement todo as completed."""
    current_time = get_current_time(session)

    todo = (
        session.query(models.SettlementTodo)
        .filter(models.SettlementTodo.market_id == market_id)
        .first()
    )

    if todo is not None:
        todo.settled_at = current_time
        session.commit()
        session.refresh(todo)

    return todo
