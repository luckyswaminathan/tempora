from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from api import deps
from schemas.trade import (
    TradeCreate,
    TradeCreateRequest,
    TradeListResponse,
    TradePriceResponse,
    TradeRecord,
)
from schemas.user import UserBase
from services.trades import TradeService

router = APIRouter(prefix="/trades", tags=["trades"])


@router.get("", response_model=TradeListResponse)
def list_trades(
    market_id: Optional[str] = Query(default=None, alias="marketId"),
    trade_service: TradeService = Depends(deps.get_trade_service),
    user: UserBase = Depends(deps.get_current_user),
) -> TradeListResponse:
    return trade_service.list_trades(user_id=user.id, market_id=market_id)


@router.post("", response_model=TradeRecord, status_code=status.HTTP_201_CREATED)
def place_trade(
    payload: TradeCreateRequest,
    trade_service: TradeService = Depends(deps.get_trade_service),
    user: UserBase = Depends(deps.get_current_user),
) -> TradeRecord:
    # Create TradeCreate with userId from authenticated user
    trade_data = TradeCreate(
        userId=user.id,
        securityId=payload.security_id,
        quantity=payload.quantity,
    )
    return trade_service.place_trade(trade_data)


@router.get("/price", response_model=TradePriceResponse)
def price_trade(
    payload: TradeCreateRequest,
    trade_service: TradeService = Depends(deps.get_trade_service),
) -> TradePriceResponse:
    return trade_service.price_trade(payload)
