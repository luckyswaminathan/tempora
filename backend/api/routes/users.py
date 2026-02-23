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


def _parse_ts(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


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

    now = datetime.now(timezone.utc)

    # Normalize joined_at (may be naive in SQLite)
    joined_at = profile.joined_at
    if joined_at.tzinfo is None:
        joined_at = joined_at.replace(tzinfo=timezone.utc)

    # Fetch all trades for the user ordered chronologically
    stmt = (
        select(models.Trade)
        .where(models.Trade.user_id == current_user.id)
        .order_by(models.Trade.created_at.asc())
    )
    trades = session.scalars(stmt).all()

    # Build full history: genesis point + trades + current balance
    balance = settings.starting_amount
    all_points: list[WalletPoint] = [WalletPoint(t=joined_at.isoformat(), v=balance)]

    for trade in trades:
        # buy: quantity > 0, wallet decreases; sell: quantity < 0, wallet increases
        if trade.quantity > 0:
            balance -= trade.price_cents
        else:
            balance += trade.price_cents
        all_points.append(WalletPoint(t=trade.created_at.isoformat(), v=balance))

    # Always append current wallet value as final point (captures resolution payouts)
    all_points.append(WalletPoint(t=now.isoformat(), v=profile.wallet))

    if days == 0:
        # All-time view: return from account creation
        return WalletHistoryResponse(data=all_points)

    # Windowed view: prepend a virtual point at the cutoff with balance at that time
    cutoff = now - timedelta(days=days)
    balance_at_cutoff = settings.starting_amount
    for p in all_points:
        if _parse_ts(p.t) < cutoff:
            balance_at_cutoff = p.v

    filtered = [p for p in all_points if _parse_ts(p.t) >= cutoff]
    cutoff_point = WalletPoint(t=cutoff.isoformat(), v=balance_at_cutoff)
    return WalletHistoryResponse(data=[cutoff_point] + filtered)
