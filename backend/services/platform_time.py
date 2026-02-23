from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from core import models
from core.config import settings
from schemas.workflow import SettlementTodoItem, SettlementTodoListResponse


class PlatformTimeService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_current_time(self) -> datetime:
        """Get the platform's current simulated time."""
        state = self.session.query(models.PlatformState).first()
        if state is None:
            state = models.PlatformState(current_time=datetime.now(timezone.utc))
            self.session.add(state)
            self.session.commit()
            self.session.refresh(state)
        return state.current_time

    def set_current_time(self, new_time: datetime) -> datetime:
        """Set the platform's current time to an absolute value."""
        if new_time.tzinfo is None:
            new_time = new_time.replace(tzinfo=timezone.utc)

        state = self.session.query(models.PlatformState).first()
        if state is None:
            state = models.PlatformState(current_time=new_time)
            self.session.add(state)
        else:
            state.current_time = new_time

        self.session.commit()
        self.session.refresh(state)

        self.check_and_close_markets()

        return state.current_time

    def advance_time(
        self, *, hours: int = 0, days: int = 0, minutes: int = 0
    ) -> datetime:
        """Advance the platform's current time by a delta."""
        current = self.get_current_time()
        new_time = current + timedelta(hours=hours, days=days, minutes=minutes)
        return self.set_current_time(new_time)

    def check_and_close_markets(self) -> List[models.SettlementTodo]:
        """
        Check for markets past their resolution_date and close them.
        Creates SettlementTodo entries for market makers.
        Returns list of newly created todos.
        """
        current_time = self.get_current_time()
        deadline_delta = timedelta(hours=settings.settlement_deadline_hours)

        open_markets_past_resolution = (
            self.session.query(models.Market)
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
                self.session.query(models.SettlementTodo)
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
                self.session.add(todo)
                created_todos.append(todo)

        self.session.commit()
        return created_todos

    def count_newly_closed_markets(self, since: datetime, until: datetime) -> int:
        """Count markets closed by a time advance (resolution_date in (since, until])."""
        return (
            self.session.query(models.Market)
            .filter(
                models.Market.status == models.MarketStatus.CLOSED,
                models.Market.resolution_date <= until,
                models.Market.resolution_date > since,
            )
            .count()
        )

    def get_settlement_todos_for_user(
        self, user_id: str, *, include_settled: bool = False
    ) -> SettlementTodoListResponse:
        """Get settlement todos for a specific market maker."""
        current_time = self.get_current_time()
        query = self.session.query(models.SettlementTodo).filter(
            models.SettlementTodo.market_maker_id == user_id
        )

        if not include_settled:
            query = query.filter(models.SettlementTodo.settled_at.is_(None))

        todos = query.order_by(models.SettlementTodo.deadline.asc()).all()
        items = [
            SettlementTodoItem(
                id=t.id,
                market_id=t.market_id,
                market_question=t.market.question if t.market else "Unknown",
                market_maker_id=t.market_maker_id,
                created_at=t.created_at,
                deadline=t.deadline,
                settled_at=t.settled_at,
                is_overdue=t.settled_at is None and t.deadline < current_time,
                hours_remaining=(
                    (t.deadline - current_time).total_seconds() / 3600
                    if t.settled_at is None
                    else None
                ),
            )
            for t in todos
        ]
        return SettlementTodoListResponse(
            todos=items,
            count=len(items),
            platform_time=current_time,
        )

    def mark_todo_settled(self, market_id: str) -> SettlementTodoItem | None:
        """Mark a settlement todo as completed."""
        current_time = self.get_current_time()

        todo = (
            self.session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id == market_id)
            .first()
        )

        if todo is None:
            return None

        if todo.settled_at is not None:
            # Already settled — return current state without overwriting.
            return SettlementTodoItem(
                id=todo.id,
                market_id=todo.market_id,
                market_question=todo.market.question if todo.market else "Unknown",
                market_maker_id=todo.market_maker_id,
                created_at=todo.created_at,
                deadline=todo.deadline,
                settled_at=todo.settled_at,
                is_overdue=False,
                hours_remaining=None,
            )

        todo.settled_at = current_time
        self.session.commit()
        self.session.refresh(todo)

        return SettlementTodoItem(
            id=todo.id,
            market_id=todo.market_id,
            market_question=todo.market.question if todo.market else "Unknown",
            market_maker_id=todo.market_maker_id,
            created_at=todo.created_at,
            deadline=todo.deadline,
            settled_at=todo.settled_at,
            is_overdue=False,  # just settled
            hours_remaining=None,
        )
