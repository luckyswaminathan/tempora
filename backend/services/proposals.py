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
from services.markets import MarketService
from utils.collateral import get_user_collateral_locked


def calculate_max_loss_cents(liquidity_parameter: float, num_outcomes: int) -> int:
    """Calculate the maximum loss for a market maker: b * ln(N) in cents."""
    if liquidity_parameter <= 0 or num_outcomes < 2:
        return 0
    return int(liquidity_parameter * log(num_outcomes) * 100)  # Convert to cents


class ProposalService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.market_service = MarketService(self.session)

    def create_proposal(self, proposer_id: str, payload: ProposalCreate) -> Proposal:
        """Create a new market proposal."""
        if len(payload.outcomes) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 outcomes are required",
            )

        # Convert Pydantic outcomes to dicts for JSON storage
        outcomes = [o.model_dump(by_alias=True) for o in payload.outcomes]

        proposal = models.MarketProposal(
            proposer_id=proposer_id,
            question=payload.question,
            category=payload.category,
            description=payload.description,
            resolution_date=payload.resolution_date,
            outcomes=outcomes,
            tags=payload.tags or [],
            liquidity_parameter=payload.liquidity_parameter,
            ui_type=payload.ui_type,
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

    def get_all_proposals(
        self, status_filter: Optional[str] = None
    ) -> ProposalListResponse:
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
        self,
        proposal_id: str,
        reviewer_id: str,
        approved: bool,
        note: Optional[str] = None,
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

        # Calculate the funding collateral (max loss = b * ln(N))
        # This represents the worst-case loss for the market maker (the collateral they must have).
        # The market maker does NOT pay this upfront - they only pay out during settlement.
        liquidity = proposal.liquidity_parameter or 100.0
        num_outcomes = len(proposal.outcomes)
        funding_collateral_cents = calculate_max_loss_cents(liquidity, num_outcomes)

        # Calculate total collateral already locked (from short positions + other markets)
        current_collateral_locked = get_user_collateral_locked(self.session, user_id)

        # Verify market maker has enough funds to cover worst-case loss plus existing collateral
        total_collateral_required = current_collateral_locked + funding_collateral_cents
        if profile.wallet < total_collateral_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient funds to cover collateral requirements. Total required: ${total_collateral_required/100:.2f} (Current locked: ${current_collateral_locked/100:.2f} + New market: ${funding_collateral_cents/100:.2f}), Available: ${profile.wallet/100:.2f}",
            )

        # Create the actual market with creator info
        market = self.market_service.create_market(
            proposal, user_id, funding_collateral_cents
        )
        proposal.created_market_id = market.id
        proposal.status = ProposalStatus.LIVE

        self.session.commit()
        self.session.refresh(proposal)

        return self._to_schema(proposal, include_proposer=True)

    def _to_schema(
        self, proposal: models.MarketProposal, include_proposer: bool = False
    ) -> Proposal:
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
            uiType=proposal.ui_type,
            status=proposal.status,
            reviewerId=proposal.reviewer_id,
            reviewNote=proposal.review_note,
            reviewedAt=proposal.reviewed_at,
            createdMarketId=proposal.created_market_id,
            createdAt=proposal.created_at,
            updatedAt=proposal.updated_at,
        )
