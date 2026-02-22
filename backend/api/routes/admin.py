from datetime import datetime
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
from services import platform_time

router = APIRouter(prefix="/admin", tags=["admin"])


def get_proposal_service(
    session: Session = Depends(deps.get_session),
) -> ProposalService:
    return ProposalService(session)


class UserListItem(BaseModel):
    id: str
    email: str
    role: str
    display_name: str | None = None
    wallet: int
    created_at: str | None = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: List[UserListItem]
    count: int


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


@router.get("/users", response_model=UserListResponse)
def list_all_users(
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> UserListResponse:
    """List all users (admin only)."""
    users = session.query(models.User).all()

    user_items = []
    for user in users:
        profile = (
            session.query(models.Profile).filter(models.Profile.id == user.id).first()
        )
        user_items.append(
            UserListItem(
                id=user.id,
                email=user.email,
                role=user.role,
                display_name=profile.display_name if profile else None,
                wallet=profile.wallet if profile else 0,
                created_at=user.created_at.isoformat() if user.created_at else None,
            )
        )

    return UserListResponse(users=user_items, count=len(user_items))


@router.get("/market-makers", response_model=UserListResponse)
def list_market_makers(
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> UserListResponse:
    """List all market makers (admin only)."""
    users = (
        session.query(models.User)
        .filter(models.User.role == UserRole.MARKET_MAKER)
        .all()
    )

    user_items = []
    for user in users:
        profile = (
            session.query(models.Profile).filter(models.Profile.id == user.id).first()
        )
        user_items.append(
            UserListItem(
                id=user.id,
                email=user.email,
                role=user.role,
                display_name=profile.display_name if profile else None,
                wallet=profile.wallet if profile else 0,
                created_at=user.created_at.isoformat() if user.created_at else None,
            )
        )

    return UserListResponse(users=user_items, count=len(user_items))


@router.patch("/users/{user_id}/role", response_model=UserListItem)
def update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> UserListItem:
    """Update a user's role (admin only)."""
    user = session.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.role = payload.role
    session.commit()
    session.refresh(user)

    profile = session.query(models.Profile).filter(models.Profile.id == user.id).first()

    return UserListItem(
        id=user.id,
        email=user.email,
        role=user.role,
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


class PlatformTimeResponse(BaseModel):
    current_time: datetime
    settlement_deadline_hours: int


class SetTimeRequest(BaseModel):
    current_time: datetime


class AdvanceTimeRequest(BaseModel):
    hours: int = 0
    days: int = 0
    minutes: int = 0


class AdvanceTimeResponse(BaseModel):
    previous_time: datetime
    current_time: datetime
    markets_closed: int


@router.get("/time", response_model=PlatformTimeResponse)
def get_platform_time(
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> PlatformTimeResponse:
    """Get the current platform time (admin only)."""
    from core.config import settings

    current_time = platform_time.get_current_time(session)
    return PlatformTimeResponse(
        current_time=current_time,
        settlement_deadline_hours=settings.settlement_deadline_hours,
    )


@router.post("/time", response_model=PlatformTimeResponse)
def set_platform_time(
    payload: SetTimeRequest,
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> PlatformTimeResponse:
    """Set the platform time to an absolute value (admin only)."""
    from core.config import settings

    new_time = platform_time.set_current_time(session, payload.current_time)
    return PlatformTimeResponse(
        current_time=new_time,
        settlement_deadline_hours=settings.settlement_deadline_hours,
    )


@router.post("/time/advance", response_model=AdvanceTimeResponse)
def advance_platform_time(
    payload: AdvanceTimeRequest,
    current_user: UserBase = Depends(deps.get_current_admin),
    session: Session = Depends(deps.get_session),
) -> AdvanceTimeResponse:
    """Advance the platform time by a specified duration (admin only)."""
    previous_time = platform_time.get_current_time(session)
    new_time = platform_time.advance_time(
        session, hours=payload.hours, days=payload.days, minutes=payload.minutes
    )

    closed_markets = (
        session.query(models.Market)
        .filter(
            models.Market.status == models.MarketStatus.CLOSED,
            models.Market.resolution_date <= new_time,
            models.Market.resolution_date > previous_time,
        )
        .count()
    )

    return AdvanceTimeResponse(
        previous_time=previous_time,
        current_time=new_time,
        markets_closed=closed_markets,
    )
