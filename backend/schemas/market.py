from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class SettlementDate(BaseModel):
    label: str
    date: datetime


class MarketBase(BaseModel):
    id: str
    question: str
    category: str
    status: Literal["open", "closed", "resolved", "suspended"] = "open"
    resolution_date: datetime = Field(alias="resolutionDate")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class MarketCreate(BaseModel):
    question: str
    category: str
    resolution_date: datetime = Field(alias="resolutionDate")
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    initial_liquidity: float = Field(default=500.0, alias="initialLiquidity", ge=0.0)


class MarketUpdate(BaseModel):
    question: Optional[str] = None
    category: Optional[str] = None
    resolution_date: Optional[datetime] = Field(default=None, alias="resolutionDate")
    description: Optional[str] = None
    status: Optional[Literal["open", "closed", "resolved", "suspended"]] = None
    tags: Optional[List[str]] = None


class MarketQuote(BaseModel):
    yes_price_cents: float = Field(alias="yesPriceCents")
    no_price_cents: float = Field(alias="noPriceCents")
    implied_probability: float = Field(alias="impliedProbability")
    last_calculated_at: datetime = Field(alias="lastCalculatedAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketWithQuote(MarketBase):
    quote: MarketQuote
    total_volume: float = Field(alias="totalVolume")
    open_interest: float = Field(alias="openInterest")
    settlement_dates: List[SettlementDate] = Field(default_factory=list, alias="settlementDates")


class MarketListResponse(BaseModel):
    items: List[MarketWithQuote]
    count: int
