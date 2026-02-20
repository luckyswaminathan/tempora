from pydantic import BaseModel, ConfigDict, Field

from schemas.date import UTCDateTime


class Leg(BaseModel):
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")

    model_config = ConfigDict(populate_by_name=True)


class OrderCreateRequest(BaseModel):
    """Request payload from client (without userId)."""

    market_id: str = Field(alias="marketId")
    legs: list[Leg] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class OrderCreate(BaseModel):
    """Internal order creation model (with userId)."""

    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    legs: list[Leg] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class OrderPriceResponse(BaseModel):
    price_cents: int = Field(alias="priceCents")
    priced_at: UTCDateTime = Field(alias="pricedAt")

    model_config = ConfigDict(populate_by_name=True)


class TradeRecord(BaseModel):
    """Trade record nested within an Order."""

    id: str
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")
    price_cents: int = Field(
        alias="priceCents", description="price of the entire trade"
    )
    created_at: UTCDateTime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class OrderRecord(BaseModel):
    id: str
    type: str
    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    created_at: UTCDateTime = Field(alias="createdAt")
    filled: bool
    trades: list[TradeRecord] = Field(default_factory=list)
    price_cents: int = Field(
        alias="priceCents",
        description="total price of all trades in this order",
    )

    model_config = ConfigDict(populate_by_name=True)


class OrderListResponse(BaseModel):
    items: list[OrderRecord]
    count: int

    model_config = ConfigDict(populate_by_name=True)
