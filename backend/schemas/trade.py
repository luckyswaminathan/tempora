from pydantic import BaseModel, ConfigDict, Field

from schemas.date import UTCDateTime


class Leg(BaseModel):
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")

    model_config = ConfigDict(populate_by_name=True)


class TradeCreateRequest(BaseModel):
    """Request payload from client (without userId)."""

    market_id: str = Field(alias="marketId")
    legs: list[Leg] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class TradeCreate(BaseModel):
    """Internal trade creation model (with userId)."""

    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    legs: list[Leg] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class TradeRecord(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    trade_group_id: str = Field(
        alias="tradeGroupId",
        description="identifies the multi-leg trade that this leg belongs to",
    )
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")
    price_cents: int = Field(
        alias="priceCents", description="price of the entire trade"
    )
    created_at: UTCDateTime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class TradeListResponse(BaseModel):
    items: list[TradeRecord]
    count: int

    model_config = ConfigDict(populate_by_name=True)


class TradePriceResponse(BaseModel):
    price_cents: int = Field(alias="priceCents")
    priced_at: UTCDateTime = Field(alias="pricedAt")

    model_config = ConfigDict(populate_by_name=True)


class TradePlaceResponse(BaseModel):
    price_cents: int = Field(alias="priceCents")
    executed_at: UTCDateTime = Field(alias="executedAt")

    model_config = ConfigDict(populate_by_name=True)


class PriceHistoryData(BaseModel):
    price_cents: int = Field(alias="priceCents")
    date: UTCDateTime

    model_config = ConfigDict(populate_by_name=True)


class PriceHistoryResponse(BaseModel):
    history: list[PriceHistoryData]

    model_config = ConfigDict(populate_by_name=True)
