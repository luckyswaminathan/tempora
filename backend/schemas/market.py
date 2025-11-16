from datetime import datetime
from enum import StrEnum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SettlementDate(BaseModel):
    label: str
    date: datetime


class Security(BaseModel):
    id: str
    market_id: str = Field(alias="marketId")
    outcome: str
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    RESOLVED = "resolved"
    SUSPENDED = "suspended"


class MarketBase(BaseModel):
    id: str
    question: str
    category: str
    status: MarketStatus = MarketStatus.OPEN
    resolution_date: datetime = Field(alias="resolutionDate")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class MarketCreate(BaseModel):
    question: str
    outcomes: List[str] = Field(default_factory=list)
    category: str
    resolution_date: datetime = Field(alias="resolutionDate")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    liquidity_parameter: float = Field(
        default=500.0, alias="liquidityParameter", ge=0.0
    )


class MarketUpdate(BaseModel):
    question: Optional[str] = None
    category: Optional[str] = None
    resolution_date: Optional[datetime] = Field(default=None, alias="resolutionDate")
    description: Optional[str] = None
    status: Optional[MarketStatus] = None
    tags: Optional[List[str]] = None


class MarketQuote(BaseModel):
    security_id: str = Field(alias="securityId")
    quantity: int
    buy_unit_price_cents: float = Field(alias="buyUnitPriceCents")
    sell_unit_price_cents: float = Field(alias="sellUnitPriceCents")
    implied_probability: float = Field(alias="impliedProbability")
    last_calculated_at: datetime = Field(alias="lastCalculatedAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketWithQuote(MarketBase):
    quotes: List[MarketQuote] = Field(default_factory=list)
    total_volume: float = Field(alias="totalVolume")
    open_interest: float = Field(alias="openInterest")
    liquidity_parameter: float = Field(
        default=500.0, alias="liquidityParameter", ge=0.0
    )
    settlement_dates: List[SettlementDate] = Field(
        default_factory=list, alias="settlementDates"
    )


class MarketListResponse(BaseModel):
    items: List[MarketWithQuote]
    count: int


class MarketSecuritiesResponse(BaseModel):
    items: List[Security]
    count: int
