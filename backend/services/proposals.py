from __future__ import annotations

from datetime import datetime, timezone
from math import log
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core import models
from core.models import ProposalStatus
from schemas.proposal import (
    Proposal,
    ProposalCreate,
    ProposalListResponse,
    ProposerInfo,
)


def calculate_max_loss_cents(liquidity_parameter: float, num_outcomes: int) -> int:
    """Calculate the maximum loss for a market maker: b * ln(N) in cents."""
    if liquidity_parameter <= 0 or num_outcomes < 2:
        return 0
    return int(liquidity_parameter * log(num_outcomes) * 100)  # Convert to cents


class ProposalService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_proposal(self, proposer_id: str, payload: ProposalCreate) -> Proposal:
        """Create a new market proposal."""
        if len(payload.outcomes) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 outcomes are required",
            )

        proposal = models.MarketProposal(
            proposer_id=proposer_id,
            question=payload.question,
            category=payload.category,
            description=payload.description,
            resolution_date=payload.resolution_date,
            outcomes=payload.outcomes,
            tags=payload.tags or [],
            liquidity_parameter=payload.liquidity_parameter,
            status=ProposalStatus.PENDING,
        )
        self.session.add(proposal)
        self.session.commit()
        self.session.refresh(proposal)

        return self._to_schema(proposal)

    def get_my_proposals(self, user_id: str) -> ProposalListResponse:
        """Get all proposals for a specific user."""
        proposals = (
            self.session.query(models.MarketProposal)
            .filter(models.MarketProposal.proposer_id == user_id)
            .order_by(models.MarketProposal.created_at.desc())
            .all()
        )
        return ProposalListResponse(
            proposals=[self._to_schema(p, include_proposer=True) for p in proposals],
            count=len(proposals),
        )

    def get_pending_proposals(self) -> ProposalListResponse:
        """Get all pending proposals (for admin review)."""
        proposals = (
            self.session.query(models.MarketProposal)
            .filter(models.MarketProposal.status == ProposalStatus.PENDING)
            .order_by(models.MarketProposal.created_at.asc())
            .all()
        )
        return ProposalListResponse(
            proposals=[self._to_schema(p, include_proposer=True) for p in proposals],
            count=len(proposals),
        )

    def get_all_proposals(self, status_filter: Optional[str] = None) -> ProposalListResponse:
        """Get all proposals with optional status filter (for admin)."""
        query = self.session.query(models.MarketProposal)
        if status_filter:
            query = query.filter(models.MarketProposal.status == status_filter)
        proposals = query.order_by(models.MarketProposal.created_at.desc()).all()
        return ProposalListResponse(
            proposals=[self._to_schema(p, include_proposer=True) for p in proposals],
            count=len(proposals),
        )

    def review_proposal(
        self, proposal_id: str, reviewer_id: str, approved: bool, note: Optional[str] = None
    ) -> Proposal:
        """Approve or reject a proposal."""
        proposal = self.session.get(models.MarketProposal, proposal_id)
        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proposal not found",
            )

        if proposal.status != ProposalStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Proposal has already been reviewed",
            )

        proposal.reviewer_id = reviewer_id
        proposal.review_note = note
        proposal.reviewed_at = datetime.now(timezone.utc)

        if approved:
            proposal.status = ProposalStatus.APPROVED
            # Market maker will publish it later
        else:
            proposal.status = ProposalStatus.REJECTED

        self.session.commit()
        self.session.refresh(proposal)

        return self._to_schema(proposal, include_proposer=True)

    def publish_proposal(self, proposal_id: str, user_id: str) -> Proposal:
        """Publish an approved proposal to create a live market (market maker only)."""
        proposal = self.session.get(models.MarketProposal, proposal_id)
        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proposal not found",
            )

        # Check that the user owns this proposal
        if proposal.proposer_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only publish your own proposals",
            )

        if proposal.status != ProposalStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only approved proposals can be published",
            )

        # Get market maker's profile
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

        # Calculate the initial funding required (max loss = b * ln(N))
        liquidity = proposal.liquidity_parameter or 100.0
        num_outcomes = len(proposal.outcomes)
        initial_funding_cents = calculate_max_loss_cents(liquidity, num_outcomes)

        # Check if market maker has enough funds
        if profile.wallet < initial_funding_cents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient funds. Required: ${initial_funding_cents/100:.2f}, Available: ${profile.wallet/100:.2f}",
            )

        # Deduct the funding from market maker's wallet
        profile.wallet -= initial_funding_cents

        # Create the actual market with creator info
        market = self._create_market_from_proposal(proposal, user_id, initial_funding_cents)
        proposal.created_market_id = market.id
        proposal.status = ProposalStatus.LIVE

        self.session.commit()
        self.session.refresh(proposal)

        return self._to_schema(proposal, include_proposer=True)

    def _create_market_from_proposal(
        self, proposal: models.MarketProposal, creator_id: str, initial_funding_cents: int
    ) -> models.Market:
        """Create a market from an approved proposal."""
        from services.markets import MarketService
        from schemas.market import MarketCreate, OutcomeWithValue

        market_service = MarketService(self.session)
        
        # Convert string outcomes to OutcomeWithValue objects
        outcomes = [
            OutcomeWithValue(outcome=o, value=float(i + 1), isCatchAll=False)
            for i, o in enumerate(proposal.outcomes)
        ]
        
        market_data = MarketCreate(
            question=proposal.question,
            category=proposal.category,
            description=proposal.description,
            resolutionDate=proposal.resolution_date.isoformat(),
            outcomes=outcomes,
            tags=proposal.tags,
            liquidityParameter=proposal.liquidity_parameter,
        )
        # Use internal method to create market with creator info
        market = market_service._create_market_internal(
            market_data, creator_id=creator_id, initial_funding_cents=initial_funding_cents
        )
        return market

    def _to_schema(self, proposal: models.MarketProposal, include_proposer: bool = False) -> Proposal:
        """Convert a MarketProposal model to a Proposal schema."""
        proposer_info = None
        if include_proposer and proposal.proposer:
            profile = self.session.get(models.Profile, proposal.proposer_id)
            proposer_info = ProposerInfo(
                id=proposal.proposer.id,
                email=proposal.proposer.email,
                displayName=profile.display_name if profile else None,
            )

        return Proposal(
            id=proposal.id,
            proposerId=proposal.proposer_id,
            proposer=proposer_info,
            question=proposal.question,
            category=proposal.category,
            description=proposal.description,
            resolutionDate=proposal.resolution_date,
            outcomes=proposal.outcomes,
            tags=proposal.tags or [],
            liquidityParameter=proposal.liquidity_parameter,
            status=proposal.status,
            reviewerId=proposal.reviewer_id,
            reviewNote=proposal.review_note,
            reviewedAt=proposal.reviewed_at,
            createdMarketId=proposal.created_market_id,
            createdAt=proposal.created_at,
            updatedAt=proposal.updated_at,
        )

