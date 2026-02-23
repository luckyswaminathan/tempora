from typing import List

from pydantic import BaseModel, ConfigDict, Field


class Holding(BaseModel):
    market_id: str = Field(alias="marketId")
    security_id: str = Field(alias="securityId")
    question: str
    outcome: str
    avg_price_cents: float = Field(alias="avgPriceCents")
    quantity: int
    mark_price_cents: float = Field(alias="markPriceCents")
    end_date: str = Field(alias="endDate")
    pnl: int = Field(alias="pnl", description="pnl in cents")
    category: str

    model_config = ConfigDict(populate_by_name=True)


class PortfolioSummary(BaseModel):
    cost_basis: int = Field(alias="costBasis")
    market_value: float = Field(alias="marketValue")
    unrealised_pnl: float = Field(alias="unrealisedPnL")
    roi: float
    avg_probability: float = Field(
        alias="avgProbability",
        description=(
            "Position-cost-weighted average win probability across all markets. "
            "Per-market probability is the sum of mark prices for held securities, "
            "capped at 100."
        ),
    )

    model_config = ConfigDict(populate_by_name=True)


class PortfolioSnapshot(BaseModel):
    wallet: int
    spendable_balance: int = Field(
        alias="spendableBalance", description="Wallet minus locked collateral"
    )
    collateral_locked: int = Field(
        alias="collateralLocked", description="Collateral locked for short positions"
    )
    holdings: List[Holding]
    summary: PortfolioSummary

    model_config = ConfigDict(populate_by_name=True)


class ShortPosition(BaseModel):
    """Individual short position within a market."""

    outcome: str
    quantity: int  # negative value

    model_config = ConfigDict(populate_by_name=True)


class MarketShortCollateral(BaseModel):
    """Short collateral for a market (max short position * $1)."""

    market_id: str = Field(alias="marketId")
    question: str
    positions: List[ShortPosition] = Field(
        description="All short positions in this market"
    )
    collateral_cents: int = Field(
        alias="collateralCents",
        description="Collateral required = max(abs(quantity)) * 100",
    )

    model_config = ConfigDict(populate_by_name=True)


class LimitOrderCollateral(BaseModel):
    order_id: str = Field(alias="orderId")
    market_id: str = Field(alias="marketId")
    question: str
    collateral_cents: int = Field(alias="collateralCents")
    created_at: str = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class MarketMakerCollateral(BaseModel):
    market_id: str = Field(alias="marketId")
    question: str
    initial_funding_cents: int = Field(
        alias="initialFundingCents",
        description="b·ln(N) worst-case net loss set at market creation",
    )
    revenue_cents: int = Field(
        alias="revenueCents",
        description="Trade revenue already collected into wallet",
    )
    effective_collateral_cents: int = Field(
        alias="effectiveCollateralCents",
        description=(
            "initialFunding + revenue: total worst-case payout obligation. "
            "Increases when traders buy (revenue > 0), decreases when traders sell "
            "back to the AMM (revenue < 0, reducing payout exposure)."
        ),
    )
    end_date: str = Field(alias="endDate")

    model_config = ConfigDict(populate_by_name=True)


class CollateralBreakdown(BaseModel):
    total_locked: int = Field(alias="totalLocked")
    short_markets: List[MarketShortCollateral] = Field(
        alias="shortMarkets",
        description="Short collateral grouped by market (max short * $1)",
    )
    total_short_collateral: int = Field(alias="totalShortCollateral")
    limit_orders: List[LimitOrderCollateral] = Field(alias="limitOrders")
    total_limit_order_collateral: int = Field(alias="totalLimitOrderCollateral")
    market_maker_markets: List[MarketMakerCollateral] = Field(
        alias="marketMakerMarkets"
    )
    total_market_maker_collateral: int = Field(alias="totalMarketMakerCollateral")

    model_config = ConfigDict(populate_by_name=True)
