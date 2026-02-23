from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from api import deps
from schemas.workflow import (
    Proposal,
    ProposalCreate,
    ProposalListResponse,
    ProposalReview,
)
from schemas.user import UserBase
from services.proposals import ProposalService
from sqlalchemy.orm import Session

router = APIRouter(prefix="/proposals", tags=["proposals"])


def get_proposal_service(
    session: Session = Depends(deps.get_session),
) -> ProposalService:
    return ProposalService(session)


@router.post("", response_model=Proposal, status_code=status.HTTP_201_CREATED)
def create_proposal(
    payload: ProposalCreate,
    current_user: UserBase = Depends(deps.get_current_market_maker),
    service: ProposalService = Depends(get_proposal_service),
) -> Proposal:
    """Submit a new market proposal (market makers only)."""
    return service.create_proposal(current_user.id, payload)


@router.get("/mine", response_model=ProposalListResponse)
def get_my_proposals(
    current_user: UserBase = Depends(deps.get_current_market_maker),
    service: ProposalService = Depends(get_proposal_service),
) -> ProposalListResponse:
    """Get all proposals submitted by the current user."""
    return service.get_my_proposals(current_user.id)


@router.get("/pending", response_model=ProposalListResponse)
def get_pending_proposals(
    current_user: UserBase = Depends(deps.get_current_admin),
    service: ProposalService = Depends(get_proposal_service),
) -> ProposalListResponse:
    """Get all pending proposals (admin only)."""
    return service.get_pending_proposals()


@router.get("", response_model=ProposalListResponse)
def list_all_proposals(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: UserBase = Depends(deps.get_current_admin),
    service: ProposalService = Depends(get_proposal_service),
) -> ProposalListResponse:
    """List all proposals with optional status filter (admin only)."""
    return service.get_all_proposals(status_filter=status_filter)


@router.post("/{proposal_id}/review", response_model=Proposal)
def review_proposal(
    proposal_id: str,
    payload: ProposalReview,
    current_user: UserBase = Depends(deps.get_current_admin),
    service: ProposalService = Depends(get_proposal_service),
) -> Proposal:
    """Approve or reject a proposal (admin only)."""
    return service.review_proposal(
        proposal_id=proposal_id,
        reviewer_id=current_user.id,
        approved=payload.approved,
        note=payload.note,
    )


@router.post("/{proposal_id}/publish", response_model=Proposal)
def publish_proposal(
    proposal_id: str,
    current_user: UserBase = Depends(deps.get_current_market_maker),
    service: ProposalService = Depends(get_proposal_service),
) -> Proposal:
    """Publish an approved proposal to make it a live market (market maker only)."""
    return service.publish_proposal(proposal_id, current_user.id)
