from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from api import deps
from core.config import settings
from schemas.portfolio import PortfolioSnapshot, CollateralBreakdown
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


@router.get("/me/collateral", response_model=CollateralBreakdown)
def get_my_collateral(
    current_user: UserBase = Depends(deps.get_current_user),
    portfolio_service: PortfolioService = Depends(deps.get_portfolio_service),
) -> CollateralBreakdown:
    return portfolio_service.get_collateral_breakdown(current_user.id)


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


class WalletPoint(BaseModel):
    t: str  # ISO datetime
    v: int  # balance in cents


class WalletHistoryResponse(BaseModel):
    data: list[WalletPoint]


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


@router.get("/me/wallet-history", response_model=WalletHistoryResponse)
def get_wallet_history(
    days: int = Query(default=30, ge=0),
    current_user: UserBase = Depends(deps.get_current_user),
    session: Session = Depends(deps.get_session),
) -> WalletHistoryResponse:
    """Return approximate wallet balance history reconstructed from trade records."""
    profile = session.get(models.Profile, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
        )

    # Fetch all trades for the user ordered chronologically
    stmt = (
        select(models.Trade)
        .where(models.Trade.user_id == current_user.id)
        .order_by(models.Trade.created_at.asc())
    )
    trades = session.scalars(stmt).all()

    # Build full history starting from the platform starting balance
    balance = settings.starting_amount
    points: list[WalletPoint] = []

    for trade in trades:
        # buy: quantity > 0, wallet decreases; sell: quantity < 0, wallet increases
        if trade.quantity > 0:
            balance -= trade.price_cents
        else:
            balance += trade.price_cents
        points.append(WalletPoint(t=trade.created_at.isoformat(), v=balance))

    # Filter to requested window
    if days > 0 and points:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        # fromisoformat may return naive or aware depending on stored value; normalize
        def _parse(ts: str) -> datetime:
            dt = datetime.fromisoformat(ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt

        points = [p for p in points if _parse(p.t) >= cutoff]

    # Always append current wallet value as final point (captures resolution payouts)
    now_iso = datetime.now(timezone.utc).isoformat()
    if points:
        points.append(WalletPoint(t=now_iso, v=profile.wallet))
    else:
        # No trades in window — return a flat line at current balance
        points = [WalletPoint(t=now_iso, v=profile.wallet)]

    return WalletHistoryResponse(data=points)
