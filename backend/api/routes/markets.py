from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from api import deps
from schemas.market import (
    MarketCreate,
    MarketListResponse,
    MarketUpdate,
    Market,
)
from schemas.user import UserBase
from services.markets import MarketService

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("", response_model=MarketListResponse)
def list_markets(
    category: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    service: MarketService = Depends(deps.get_market_service),
) -> MarketListResponse:
    return service.list_markets(category=category, status_filter=status_filter)


@router.post("", response_model=Market, status_code=status.HTTP_201_CREATED)
def create_market(
    payload: MarketCreate,
    service: MarketService = Depends(deps.get_market_service),
    _: UserBase = Depends(deps.get_current_user),
) -> Market:
    return service.create_market(payload)


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
    _: UserBase = Depends(deps.get_current_user),
) -> Market:
    return service.update_market(market_id, payload)
