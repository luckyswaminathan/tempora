from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_session
from schemas.user import UserBase
from services.markets import MarketService
from services.trades import TradeService
from services.auth import AuthService
from services.portfolio import PortfolioService


def get_auth_service(session: Session = Depends(get_session)) -> AuthService:
    return AuthService(session)


def get_market_service(session: Session = Depends(get_session)) -> MarketService:
    return MarketService(session)


def get_trade_service(session: Session = Depends(get_session)) -> TradeService:
    return TradeService(session)


def get_portfolio_service(session: Session = Depends(get_session)) -> PortfolioService:
    return PortfolioService(session)


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
