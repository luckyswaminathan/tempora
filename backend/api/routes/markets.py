from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api import deps
from schemas.market import (
    Market,
    MarketListResponse,
    MarketUpdate,
    MarketSettlement,
    MarketSettlementResponse,
    MarketMakerDashboard,
)
from schemas.user import UserBase
from services.markets import MarketService
from services import platform_time

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("", response_model=MarketListResponse)
def list_markets(
    category: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    service: MarketService = Depends(deps.get_market_service),
) -> MarketListResponse:
    return service.list_markets(category=category, status_filter=status_filter)


@router.get("/{market_id}", response_model=Market)
def get_market(
    market_id: str,
    service: MarketService = Depends(deps.get_market_service),
) -> Market:
    return service.get_market(market_id)


@router.patch("/{market_id}", response_model=Market)
def update_market(
    market_id: str,
    payload: MarketUpdate,
    service: MarketService = Depends(deps.get_market_service),
    _: UserBase = Depends(deps.get_current_admin),
) -> Market:
    return service.update_market(market_id, payload)


@router.put("/settle", response_model=MarketSettlementResponse)
def settle_market(
    payload: MarketSettlement,
    service: MarketService = Depends(deps.get_market_service),
    _: UserBase = Depends(deps.get_current_admin),
) -> MarketSettlementResponse:
    return service.settle_market(payload)


@router.get("/maker/dashboard", response_model=MarketMakerDashboard)
def get_market_maker_dashboard(
    service: MarketService = Depends(deps.get_market_service),
    current_user: UserBase = Depends(deps.get_current_market_maker),
) -> MarketMakerDashboard:
    """Get market maker dashboard with P&L for all their markets."""
    return service.get_market_maker_dashboard(current_user.id)


class SettlementTodoItem(BaseModel):
    id: str
    market_id: str
    market_question: str
    market_maker_id: str
    created_at: datetime
    deadline: datetime
    settled_at: datetime | None
    is_overdue: bool
    hours_remaining: float | None

    class Config:
        from_attributes = True


class SettlementTodoListResponse(BaseModel):
    todos: List[SettlementTodoItem]
    count: int
    platform_time: datetime


@router.get("/maker/todos", response_model=SettlementTodoListResponse)
def get_settlement_todos(
    include_settled: bool = Query(default=False),
    current_user: UserBase = Depends(deps.get_current_market_maker),
    session: Session = Depends(deps.get_session),
) -> SettlementTodoListResponse:
    """Get settlement TODOs for the current market maker."""
    current_time = platform_time.get_current_time(session)
    todos = platform_time.get_settlement_todos_for_user(
        session, current_user.id, include_settled=include_settled
    )

    todo_items = []
    for todo in todos:
        is_overdue = todo.settled_at is None and todo.deadline < current_time
        hours_remaining = None
        if todo.settled_at is None:
            delta = todo.deadline - current_time
            hours_remaining = delta.total_seconds() / 3600

        todo_items.append(
            SettlementTodoItem(
                id=todo.id,
                market_id=todo.market_id,
                market_question=todo.market.question if todo.market else "Unknown",
                market_maker_id=todo.market_maker_id,
                created_at=todo.created_at,
                deadline=todo.deadline,
                settled_at=todo.settled_at,
                is_overdue=is_overdue,
                hours_remaining=hours_remaining,
            )
        )

    return SettlementTodoListResponse(
        todos=todo_items,
        count=len(todo_items),
        platform_time=current_time,
    )
