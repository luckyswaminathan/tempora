from fastapi import APIRouter, Depends, Query

from api import deps
from schemas.portfolio import PortfolioSnapshot
from schemas.user import (
    UserBase,
    UserProfile,
    LeaderboardResponse,
    UpdateTutorialRequest,
)
from services.auth import AuthService
from services.portfolio import PortfolioService
from services.leaderboard import LeaderboardService
from services.tutorial import TutorialService

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


@router.put("/me/tutorial", response_model=UserProfile)
def update_tutorial_completion(
    payload: UpdateTutorialRequest,
    current_user: UserBase = Depends(deps.get_current_user),
    tutorial_service: TutorialService = Depends(deps.get_tutorial_service),
) -> UserProfile:
    return tutorial_service.update_tutorial_completion(
        current_user.id, payload.lesson_key, payload.completed
    )
