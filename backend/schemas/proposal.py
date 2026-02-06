from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from schemas.date import UTCDateTime
from schemas.market import MarketBase, OutcomeWithValue


class ProposalCreate(MarketBase):
    outcomes: List[OutcomeWithValue]


class ProposalReview(BaseModel):
    approved: bool
    note: Optional[str] = None


class ProposerInfo(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = Field(default=None, alias="displayName")

    model_config = ConfigDict(populate_by_name=True)


class Proposal(MarketBase):
    id: str
    proposer_id: str = Field(alias="proposerId")
    proposer: Optional[ProposerInfo] = None
    outcomes: List[OutcomeWithValue]
    status: str
    reviewer_id: Optional[str] = Field(default=None, alias="reviewerId")
    review_note: Optional[str] = Field(default=None, alias="reviewNote")
    reviewed_at: Optional[UTCDateTime] = Field(default=None, alias="reviewedAt")
    created_market_id: Optional[str] = Field(default=None, alias="createdMarketId")
    created_at: UTCDateTime = Field(alias="createdAt")
    updated_at: UTCDateTime = Field(alias="updatedAt")


class ProposalListResponse(BaseModel):
    proposals: List[Proposal]
    count: int
