from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TradeCreateRequest(BaseModel):
    """Request payload from client (without userId)."""

    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")

    model_config = ConfigDict(populate_by_name=True)


class TradeCreate(BaseModel):
    """Internal trade creation model (with userId)."""

    user_id: str = Field(alias="userId")
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")

    model_config = ConfigDict(populate_by_name=True)


class TradeRecord(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")
    price_cents: float = Field(
        alias="priceCents", description="price of the entire trade"
    )
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class TradeListResponse(BaseModel):
    items: list[TradeRecord]
    count: int


class TradePriceResponse(BaseModel):
    price: float
    priced_at: datetime = Field(alias="pricedAt")
