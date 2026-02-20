from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_session
from core.models import UserRole
from schemas.user import UserBase
from services.markets import MarketService
from services.orders import OrderService
from services.auth import AuthService
from services.portfolio import PortfolioService
from services.leaderboard import LeaderboardService
from services.tutorial import TutorialService
from services.history import HistoryService


def get_auth_service(session: Session = Depends(get_session)) -> AuthService:
    return AuthService(session)


def get_market_service(session: Session = Depends(get_session)) -> MarketService:
    return MarketService(session)


def get_order_service(session: Session = Depends(get_session)) -> OrderService:
    return OrderService(session)


def get_portfolio_service(session: Session = Depends(get_session)) -> PortfolioService:
    return PortfolioService(session)


def get_leaderboard_service(
    session: Session = Depends(get_session),
) -> LeaderboardService:
    return LeaderboardService(session)


def get_tutorial_service(session: Session = Depends(get_session)) -> TutorialService:
    return TutorialService(session)


def get_history_service(session: Session = Depends(get_session)) -> HistoryService:
    return HistoryService(session)


def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserBase:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )
    try:
        scheme, token = authorization.split()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        ) from exc
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported authorization scheme",
        )
    return auth_service.get_user_from_token(token)


def get_current_admin(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    auth_service: AuthService = Depends(get_auth_service),
):
    user = get_current_user(authorization, auth_service)
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User does not have admin role",
        )
    return user


def get_current_market_maker(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    auth_service: AuthService = Depends(get_auth_service),
    session: Session = Depends(get_session),
):
    user = get_current_user(authorization, auth_service)
    if user.role != UserRole.MARKET_MAKER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only market makers can perform this action",
        )
    return user
