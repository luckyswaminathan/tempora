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

    model_config = ConfigDict(populate_by_name=True)


class PortfolioSummary(BaseModel):
    cost_basis: int = Field(alias="costBasis")
    market_value: float = Field(alias="marketValue")
    unrealised_pnl: float = Field(alias="unrealisedPnL")
    roi: float


class PortfolioSnapshot(BaseModel):
    wallet: int
    holdings: List[Holding]
    summary: PortfolioSummary
