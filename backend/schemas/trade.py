from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


TradeSide = Literal["YES", "NO"]


class TradeCreateRequest(BaseModel):
    """Request payload from client (without userId)."""
    market_id: str = Field(alias="marketId")
    side: TradeSide
    stake: float = Field(ge=0.5, description="Dollar amount the trader is risking")
    limit_price_cents: Optional[float] = Field(
        default=None, alias="limitPriceCents", ge=1.0, le=99.0, description="Optional limit price override"
    )

    model_config = ConfigDict(populate_by_name=True)


class TradeCreate(BaseModel):
    """Internal trade creation model (with userId)."""
    user_id: str
    market_id: str = Field(alias="marketId")
    side: TradeSide
    stake: float = Field(ge=0.5, description="Dollar amount the trader is risking")
    limit_price_cents: Optional[float] = Field(
        default=None, alias="limitPriceCents", ge=1.0, le=99.0, description="Optional limit price override"
    )

    model_config = ConfigDict(populate_by_name=True)


class TradeRecord(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    side: TradeSide
    price_cents: float = Field(alias="priceCents")
    shares: float
    stake: float
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class TradeListResponse(BaseModel):
    items: list[TradeRecord]
    count: int
