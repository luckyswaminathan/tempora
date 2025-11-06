from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from api import deps
from schemas.trade import TradeCreate, TradeCreateRequest, TradeListResponse, TradeRecord
from schemas.user import UserBase
from services.trades import TradeService

router = APIRouter(prefix="/trades", tags=["trades"])


@router.get("", response_model=TradeListResponse)
def list_trades(
    market_id: Optional[str] = Query(default=None, alias="marketId"),
    user: UserBase = Depends(deps.get_current_user),
    trade_service: TradeService = Depends(deps.get_trade_service),
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
        user_id=user.id,
        market_id=payload.market_id,  # Use Python field name
        side=payload.side,
        stake=payload.stake,
        limit_price_cents=payload.limit_price_cents,  # Use Python field name
    )
    return trade_service.place_trade(trade_data)
