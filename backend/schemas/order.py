from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated, Literal, Optional, Union

from schemas.date import UTCDateTime


class Leg(BaseModel):
    security_id: str = Field(alias="securityId")
    quantity: int = Field(description="amount the trader is buying/selling")

    model_config = ConfigDict(populate_by_name=True)


class LegWithOutcome(Leg):
    """Leg with outcome name for display purposes."""

    outcome: str = Field(description="outcome name for this security")


class OrderCreateRequest(BaseModel):
    """Request payload from client (without userId)."""

    market_id: str = Field(alias="marketId")
    order_type: str = Field(default="market", alias="orderType")
    limit_price_cents: Optional[int] = Field(default=None, alias="limitPriceCents")
    legs: list[Leg] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class OrderCreate(OrderCreateRequest):
    """Internal order creation model (with userId)."""

    user_id: str = Field(alias="userId")


class OrderPriceResponse(BaseModel):
    price_cents: int = Field(alias="priceCents")
    priced_at: UTCDateTime = Field(alias="pricedAt")
    collateral_required_cents: Optional[int] = Field(
        default=None,
        alias="collateralRequiredCents",
        description="New collateral required for this trade (only present for authenticated requests)",
    )

    model_config = ConfigDict(populate_by_name=True)


class TradeRecord(BaseModel):
    """Trade record nested within an Order."""

    id: str
    security_id: str = Field(alias="securityId")
    outcome: str = Field(description="outcome name for this security")
    quantity: int = Field(description="amount the trader is buying/selling")
    price_cents: int = Field(
        alias="priceCents", description="price of the entire trade"
    )
    created_at: UTCDateTime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class _BaseOrderRecord(BaseModel):
    """Shared fields for all order records. Concrete type is determined by `type`."""

    id: str
    user_id: str = Field(alias="userId")
    market_id: str = Field(alias="marketId")
    question: str = Field(description="market question")
    collateral_locked_cents: int = Field(default=0, alias="collateralLockedCents")
    created_at: UTCDateTime = Field(alias="createdAt")
    filled: bool
    canceled: bool = Field(default=False)
    # Invariant: always non-empty — every order has at least one leg.
    legs: list[LegWithOutcome] = Field(
        min_length=1, description="order legs with outcome names (always non-empty)"
    )
    # Invariant: non-empty only when the order has been filled.
    trades: list[TradeRecord] = Field(default_factory=list)
    price_cents: int = Field(
        alias="priceCents",
        description="sum of all trade prices; 0 for unfilled/canceled orders",
    )

    model_config = ConfigDict(populate_by_name=True)


class MarketOrderRecord(_BaseOrderRecord):
    """A market order: executed immediately at the current LMSR price."""

    type: Literal["market"]


class LimitOrderRecord(_BaseOrderRecord):
    """A limit order: executes only when total price ≤ limit_price_cents."""

    type: Literal["limit"]
    limit_price_cents: int = Field(
        alias="limitPriceCents",
        description="maximum total price the trader is willing to execute at",
    )


# Discriminated union — `type` selects the concrete class.
# Use MarketOrderRecord.model_validate() / LimitOrderRecord.model_validate() when
# constructing from a dict; use this alias as a field type in response schemas.
OrderRecord = Annotated[
    Union[MarketOrderRecord, LimitOrderRecord],
    Field(discriminator="type"),
]


class OrderListResponse(BaseModel):
    items: list[OrderRecord]
    count: int

    model_config = ConfigDict(populate_by_name=True)


class OrderPlaceResponse(BaseModel):
    """Simplified response for order placement."""

    order_id: str = Field(
        alias="orderId", description="Unique identifier for the order"
    )
    filled: bool = Field(description="Whether the order was filled immediately")
    price_cents: int = Field(
        alias="priceCents", description="Total price paid/received for the order"
    )

    model_config = ConfigDict(populate_by_name=True)
