from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.models import MarketStatus
from schemas.date import UTCDateTime


class Security(BaseModel):
    id: str
    market_id: str = Field(alias="marketId")
    outcome: str = Field(min_length=1)
    value: float
    is_catch_all: bool = Field(default=False, alias="isCatchAll")
    created_at: UTCDateTime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketQuote(BaseModel):
    security_id: str = Field(alias="securityId")
    quantity_traded: int = Field(alias="quantityTraded")
    buy_unit_price_cents: int = Field(alias="buyUnitPriceCents")
    sell_unit_price_cents: int = Field(alias="sellUnitPriceCents")
    implied_probability: float = Field(alias="impliedProbability")
    last_calculated_at: UTCDateTime = Field(alias="lastCalculatedAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketBase(BaseModel):
    question: str = Field(min_length=1)
    category: str
    description: Optional[str] = None
    resolution_date: UTCDateTime = Field(alias="resolutionDate")
    tags: List[str] = Field(default_factory=list)
    liquidity_parameter: Optional[float] = Field(
        default=None, alias="liquidityParameter", ge=0.0
    )
    ui_type: str = Field(default="bars-ordered", alias="uiType")

    model_config = ConfigDict(populate_by_name=True)


class Market(MarketBase):
    id: str
    status: MarketStatus = MarketStatus.OPEN
    created_at: UTCDateTime = Field(alias="createdAt")
    updated_at: UTCDateTime = Field(alias="updatedAt")
    creator_id: str = Field(alias="creatorId")
    winning_security_id: Optional[str] = Field(default=None, alias="winningSecurityId")

    quotes: List[MarketQuote] = Field(default_factory=list)
    securities: List[Security] = Field(default_factory=list)
    open_interest: int = Field(alias="openInterest")
    total_volume: int = Field(alias="totalVolume")
    liquidity_parameter: Optional[float] = Field(
        default=None, alias="liquidityParameter", ge=0.0
    )


class OutcomeWithValue(BaseModel):
    outcome: str = Field(min_length=1)
    value: Optional[float] = None
    is_catch_all: bool = Field(default=False, alias="isCatchAll")

    model_config = ConfigDict(populate_by_name=True)


class SecurityUpdate(BaseModel):
    id: str
    outcome: str = Field(min_length=1)
    value: float
    is_catch_all: bool = Field(default=False)


class MarketUpdate(BaseModel):
    question: Optional[str] = Field(default=None, min_length=1)
    category: Optional[str] = None
    resolution_date: Optional[UTCDateTime] = Field(default=None, alias="resolutionDate")
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


class MarketMakerMarket(BaseModel):
    """Market with P&L info for market makers."""

    id: str
    question: str
    category: str
    status: MarketStatus
    resolution_date: UTCDateTime = Field(alias="resolutionDate")
    created_at: UTCDateTime = Field(alias="createdAt")
    initial_funding_cents: int = Field(
        alias="initialFundingCents",
        description="b·ln(N) worst-case net loss locked at market creation",
    )
    revenue_cents: int = Field(alias="revenueCents")  # Total received from trades
    liability_cents: int = Field(
        alias="liabilityCents"
    )  # Potential payout if resolved now
    net_pnl_cents: int = Field(
        alias="netPnlCents"
    )  # Revenue - liability (or actual P&L if resolved)
    num_trades: int = Field(alias="numTrades")
    winning_security_id: Optional[str] = Field(default=None, alias="winningSecurityId")

    model_config = ConfigDict(populate_by_name=True)


class MarketMakerDashboard(BaseModel):
    """Dashboard data for market makers."""

    markets: List[MarketMakerMarket]
    total_initial_funding_cents: int = Field(
        alias="totalInitialFundingCents",
        description="Sum of b·ln(N) across all markets",
    )
    total_revenue_cents: int = Field(alias="totalRevenueCents")
    total_liability_cents: int = Field(alias="totalLiabilityCents")
    total_net_pnl_cents: int = Field(alias="totalNetPnlCents")

    model_config = ConfigDict(populate_by_name=True)


class SettlementUserTotals(BaseModel):
    """Aggregated settlement totals for a user in a resolved market."""

    position_count: int = Field(alias="positionCount")
    total_cost_cents: int = Field(alias="totalCostCents")
    total_payout_cents: int = Field(alias="totalPayoutCents")
    total_pnl_cents: int = Field(alias="totalPnlCents")

    model_config = ConfigDict(populate_by_name=True)


class SettlementPayoutEntry(BaseModel):
    """Signed settlement transfer for a single user."""

    user_id: str = Field(alias="userId")
    payout_cents: int = Field(alias="payoutCents")

    model_config = ConfigDict(populate_by_name=True)


class SettlementInfo(BaseModel):
    """Settlement information for a resolved market."""

    market_id: str = Field(alias="marketId")
    winning_security_id: str = Field(alias="winningSecurityId")
    winning_outcome: str = Field(alias="winningOutcome")
    settlement_date: UTCDateTime = Field(alias="settlementDate")
    user_totals: Optional[SettlementUserTotals] = Field(
        default=None,
        alias="userTotals",
        description="Aggregated settlement totals for this user in the market",
    )
    payout_distribution: Optional[List[SettlementPayoutEntry]] = Field(
        default=None,
        alias="payoutDistribution",
        description="Signed settlement transfer by user (+ receives from market maker, - pays back) visible only to market maker",
    )
    market_total_revenue_cents: Optional[int] = Field(
        default=None,
        alias="marketTotalRevenueCents",
        description="Total revenue collected from all trades in this market (market maker view)",
    )
    market_total_payout_cents: Optional[int] = Field(
        default=None,
        alias="marketTotalPayoutCents",
        description="Total settlement payout distributed to winners (market maker view)",
    )
    market_net_pnl_cents: Optional[int] = Field(
        default=None,
        alias="marketNetPnlCents",
        description="Net settlement P&L for market maker (revenue - payout)",
    )

    model_config = ConfigDict(populate_by_name=True)
