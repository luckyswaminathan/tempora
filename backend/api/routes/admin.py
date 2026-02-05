from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api import deps
from core import models
from core.models import UserRole
from schemas.user import UserBase, UserProfile
from schemas.proposal import ProposalListResponse
from services.proposals import ProposalService

router = APIRouter(prefix="/admin", tags=["admin"])


def get_proposal_service(session: Session = Depends(deps.get_session)) -> ProposalService:
    return ProposalService(session)


class UserListItem(BaseModel):
    id: str
    email: str
    role: str
    is_market_maker: bool
    display_name: str | None = None
    wallet: int
    created_at: str | None = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: List[UserListItem]
    count: int


class UpdateMarketMakerRequest(BaseModel):
    is_market_maker: bool


@router.get("/users", response_model=UserListResponse)
def list_all_users(
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> UserListResponse:
    """List all users (admin only)."""
    users = session.query(models.User).all()
    
    user_items = []
    for user in users:
        profile = session.query(models.Profile).filter(models.Profile.id == user.id).first()
        user_items.append(UserListItem(
            id=user.id,
            email=user.email,
            role=user.role,
            is_market_maker=user.is_market_maker,
            display_name=profile.display_name if profile else None,
            wallet=profile.wallet if profile else 0,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ))
    
    return UserListResponse(users=user_items, count=len(user_items))


@router.get("/market-makers", response_model=UserListResponse)
def list_market_makers(
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> UserListResponse:
    """List all market makers (admin only)."""
    users = session.query(models.User).filter(models.User.is_market_maker == True).all()
    
    user_items = []
    for user in users:
        profile = session.query(models.Profile).filter(models.Profile.id == user.id).first()
        user_items.append(UserListItem(
            id=user.id,
            email=user.email,
            role=user.role,
            is_market_maker=user.is_market_maker,
            display_name=profile.display_name if profile else None,
            wallet=profile.wallet if profile else 0,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ))
    
    return UserListResponse(users=user_items, count=len(user_items))


@router.patch("/users/{user_id}/market-maker", response_model=UserListItem)
def update_market_maker_status(
    user_id: str,
    payload: UpdateMarketMakerRequest,
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> UserListItem:
    """Update a user's market maker status (admin only)."""
    user = session.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Admins cannot be market makers
    if user.role == UserRole.ADMIN and payload.is_market_maker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot be designated as market makers",
        )
    
    user.is_market_maker = payload.is_market_maker
    session.commit()
    session.refresh(user)
    
    profile = session.query(models.Profile).filter(models.Profile.id == user.id).first()
    
    return UserListItem(
        id=user.id,
        email=user.email,
        role=user.role,
        is_market_maker=user.is_market_maker,
        display_name=profile.display_name if profile else None,
        wallet=profile.wallet if profile else 0,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.get("/users/{user_id}/proposals", response_model=ProposalListResponse)
def get_user_proposals(
    user_id: str,
    current_user: UserBase = Depends(deps.get_current_admin),
    service: ProposalService = Depends(get_proposal_service),
) -> ProposalListResponse:
    """Get all proposals for a specific user (admin only)."""
    return service.get_my_proposals(user_id)

