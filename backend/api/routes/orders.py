from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status

from api import deps
from schemas.order import (
    OrderListResponse,
    OrderRecord,
    OrderCreateRequest,
    OrderCreate,
    OrderPriceResponse,
)
from schemas.user import UserBase
from services.markets import MarketService
from services.orders import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


def validate_same_market(
    payload: OrderCreateRequest,
    market_service: MarketService = Depends(deps.get_market_service),
) -> OrderCreateRequest:
    for leg in payload.legs:
        security = market_service.get_security(leg.security_id)
        if security.market_id != payload.market_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All legs must be for securities in the specified market",
            )
    return payload


@router.get("", response_model=OrderListResponse)
def list_orders(
    market_id: Optional[str] = Query(default=None, alias="marketId"),
    order_service: OrderService = Depends(deps.get_order_service),
    user: UserBase = Depends(deps.get_current_user),
) -> OrderListResponse:
    return order_service.list_orders(user_id=user.id, market_id=market_id)


@router.post("", response_model=OrderRecord, status_code=status.HTTP_201_CREATED)
def place_order(
    payload: OrderCreateRequest = Depends(validate_same_market),
    order_service: OrderService = Depends(deps.get_order_service),
    user: UserBase = Depends(deps.get_current_user),
) -> OrderRecord:
    # Create OrderCreate with userId from authenticated user
    order_data = OrderCreate(
        userId=user.id,
        marketId=payload.market_id,
        legs=payload.legs,
    )
    return order_service.place_order(order_data)


@router.post(
    "/price", response_model=OrderPriceResponse, status_code=status.HTTP_200_OK
)
def price_order(
    payload: OrderCreateRequest = Depends(validate_same_market),
    order_service: OrderService = Depends(deps.get_order_service),
) -> OrderPriceResponse:
    return order_service.price_order(payload)
