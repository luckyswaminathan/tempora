from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from core.supabase import require_supabase_client
from schemas.user import UserBase
from services.markets import MarketService
from services.trades import TradeService
from services.auth import AuthService
from services.portfolio import PortfolioService


def get_supabase_client() -> Client:
    return require_supabase_client()


def get_auth_service(client: Client = Depends(get_supabase_client)) -> AuthService:
    return AuthService(client)


def get_market_service(client: Client = Depends(get_supabase_client)) -> MarketService:
    return MarketService(client)


def get_trade_service(client: Client = Depends(get_supabase_client)) -> TradeService:
    return TradeService(client)


def get_portfolio_service(client: Client = Depends(get_supabase_client)) -> PortfolioService:
    return PortfolioService(client)


def get_current_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserBase:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    try:
        scheme, token = authorization.split()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header") from exc
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unsupported authorization scheme")
    return auth_service.get_user_from_token(token)
