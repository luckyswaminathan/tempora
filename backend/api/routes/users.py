from fastapi import APIRouter, Body, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api import deps
from schemas.portfolio import PortfolioSnapshot
from schemas.user import UserBase, UserProfile, LeaderboardResponse
from services.auth import AuthService
from services.portfolio import PortfolioService
from services.leaderboard import LeaderboardService
from core import models

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/profile", response_model=UserProfile)
def get_my_profile(
    current_user: UserBase = Depends(deps.get_current_user),
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> UserProfile:
    return auth_service.get_profile(current_user.id)


@router.get("/{user_id}/profile", response_model=UserProfile)
def get_user_profile(
    user_id: str, auth_service: AuthService = Depends(deps.get_auth_service)
) -> UserProfile:
    return auth_service.get_profile(user_id)


@router.get("/me/portfolio", response_model=PortfolioSnapshot)
def get_my_portfolio(
    current_user: UserBase = Depends(deps.get_current_user),
    portfolio_service: PortfolioService = Depends(deps.get_portfolio_service),
) -> PortfolioSnapshot:
    return portfolio_service.get_portfolio(current_user.id)


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    limit: int = Query(gt=0),
    leaderboard_service: LeaderboardService = Depends(deps.get_leaderboard_service),
) -> LeaderboardResponse:
    return leaderboard_service.get_leaderboard(limit)


class AddFundsRequest(BaseModel):
    amount: float = Body(gt=0, description="Amount in dollars to add to the wallet")


@router.post("/me/wallet/add-funds", response_model=UserProfile)
def add_funds(
    payload: AddFundsRequest,
    current_user: UserBase = Depends(deps.get_current_user),
    session: Session = Depends(deps.get_session),
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> UserProfile:
    """Add funds to user's wallet."""
    profile = session.get(models.Profile, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
        )
    
    amount_cents = int(payload.amount * 100)
    profile.wallet += amount_cents
    session.commit()
    session.refresh(profile)
    
    return auth_service.get_profile(current_user.id)
