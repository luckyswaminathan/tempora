from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.models import MarketStatus


class SettlementDate(BaseModel):
    label: str
    date: datetime


class Security(BaseModel):
    id: str
    market_id: str = Field(alias="marketId")
    outcome: str = Field(min_length=1)
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketQuote(BaseModel):
    security_id: str = Field(alias="securityId")
    quantity_traded: int = Field(alias="quantityTraded")
    buy_unit_price_cents: int = Field(alias="buyUnitPriceCents")
    sell_unit_price_cents: int = Field(alias="sellUnitPriceCents")
    implied_probability: float = Field(alias="impliedProbability")
    last_calculated_at: datetime = Field(alias="lastCalculatedAt")

    model_config = ConfigDict(populate_by_name=True)


class Market(BaseModel):
    id: str
    question: str = Field(min_length=1)
    category: str
    status: MarketStatus = MarketStatus.OPEN
    resolution_date: datetime = Field(alias="resolutionDate")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    quotes: List[MarketQuote] = Field(default_factory=list)
    securities: List[Security] = Field(default_factory=list)
    open_interest: int = Field(alias="openInterest")
    total_volume: int = Field(alias="totalVolume")
    liquidity_parameter: Optional[float] = Field(
        default=None, alias="liquidityParameter", ge=0.0
    )
    settlement_dates: List[SettlementDate] = Field(
        default_factory=list, alias="settlementDates"
    )

    model_config = ConfigDict(populate_by_name=True)


class MarketCreate(BaseModel):
    question: str = Field(min_length=1)
    outcomes: List[str] = Field(default_factory=list)
    category: str
    resolution_date: datetime = Field(alias="resolutionDate")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    liquidity_parameter: Optional[float] = Field(
        default=None, alias="liquidityParameter", ge=0.0
    )


class SecurityUpdate(BaseModel):
    id: str
    outcome: str = Field(min_length=1)


class MarketUpdate(BaseModel):
    question: Optional[str] = Field(default=None, min_length=1)
    category: Optional[str] = None
    resolution_date: Optional[datetime] = Field(default=None, alias="resolutionDate")
    description: Optional[str] = None
    status: Optional[MarketStatus] = None
    tags: Optional[List[str]] = None
    securities: Optional[List[SecurityUpdate]] = None

    model_config = ConfigDict(populate_by_name=True)


class MarketSettlement(BaseModel):
    winning_security_id: str = Field(alias="winningSecurityId")


class MarketListResponse(BaseModel):
    items: List[Market]
    count: int


class MarketSettlementResponse(BaseModel):
    id: str
    winning_outcome: str = Field(alias="winningOutcome")
    net_payout: int = Field(alias="netPayout")

    model_config = ConfigDict(populate_by_name=True)
