from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status

from api import deps
from schemas.trade import (
    TradeCreate,
    TradeCreateRequest,
    TradeListResponse,
    TradePriceResponse,
    TradePlaceResponse,
    ProbabilityHistResponse,
)
from schemas.user import UserBase
from services.markets import MarketService
from services.trades import TradeService

router = APIRouter(prefix="/trades", tags=["trades"])


def validate_same_market(
    payload: TradeCreateRequest,
    market_service: MarketService = Depends(deps.get_market_service),
) -> TradeCreateRequest:
    for trade in payload.legs:
        security = market_service.get_security(trade.security_id)
        if security.market_id != payload.market_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trades must all be for securities in the specified market",
            )
    return payload


@router.get("", response_model=TradeListResponse)
def list_trades(
    market_id: Optional[str] = Query(default=None, alias="marketId"),
    trade_service: TradeService = Depends(deps.get_trade_service),
    user: UserBase = Depends(deps.get_current_user),
) -> TradeListResponse:
    return trade_service.list_trades(user_id=user.id, market_id=market_id)


@router.post("", response_model=TradePlaceResponse, status_code=status.HTTP_201_CREATED)
def place_trade(
    payload: TradeCreateRequest = Depends(validate_same_market),
    trade_service: TradeService = Depends(deps.get_trade_service),
    user: UserBase = Depends(deps.get_current_user),
) -> TradePlaceResponse:
    # Create TradeCreate with userId from authenticated user
    trade_data = TradeCreate(
        userId=user.id,
        marketId=payload.market_id,
        legs=payload.legs,
    )
    return trade_service.place_trade(trade_data)


@router.post(
    "/price", response_model=TradePriceResponse, status_code=status.HTTP_200_OK
)
def price_trade(
    payload: TradeCreateRequest = Depends(validate_same_market),
    trade_service: TradeService = Depends(deps.get_trade_service),
) -> TradePriceResponse:
    return trade_service.price_trade(payload)


@router.get("/probability/{security_id}", response_model=ProbabilityHistResponse)
def get_probability_history(
    security_id: str, trade_service: TradeService = Depends(deps.get_trade_service)
) -> ProbabilityHistResponse:
    return trade_service.get_probability_history(security_id)
