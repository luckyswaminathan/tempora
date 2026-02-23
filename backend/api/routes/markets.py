from typing import Optional

from fastapi import APIRouter, Depends, Query

from api import deps
from schemas.market import (
    Market,
    MarketListResponse,
    MarketUpdate,
    MarketSettlement,
    MarketSettlementResponse,
    MarketMakerDashboard,
)
from schemas.workflow import SettlementTodoListResponse
from schemas.user import UserBase
from services.markets import MarketService
from services.platform_time import PlatformTimeService

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


@router.get("/maker/todos", response_model=SettlementTodoListResponse)
def get_settlement_todos(
    include_settled: bool = Query(default=False),
    current_user: UserBase = Depends(deps.get_current_market_maker),
    platform_time_service: PlatformTimeService = Depends(
        deps.get_platform_time_service
    ),
) -> SettlementTodoListResponse:
    """Get settlement TODOs for the current market maker."""
    return platform_time_service.get_settlement_todos_for_user(
        current_user.id, include_settled=include_settled
    )
