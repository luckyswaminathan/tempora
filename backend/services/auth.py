from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from core import models
from core.security import create_access_token, hash_password, verify_password
from schemas.user import (
    AuthResponse,
    AuthTokens,
    LoginRequest,
    RegisterRequest,
    UserBase,
    UserProfile,
)


class AuthService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def register(self, payload: RegisterRequest) -> AuthResponse:
        existing = (
            self.session.query(models.User)
            .filter(models.User.email == payload.email)
            .one_or_none()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with that email already exists",
            )

        user_id = str(uuid4())
        user = models.User(
            id=user_id,
            email=payload.email,
            password_hash=hash_password(payload.password),
            created_at=datetime.now(timezone.utc),
        )
        user.profile = models.Profile(
            display_name=payload.display_name,
            joined_at=datetime.now(timezone.utc),
            last_seen_at=datetime.now(timezone.utc),
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)

        token = create_access_token(user.id)
        return self._build_auth_response(user, token, token)

    def login(self, payload: LoginRequest) -> AuthResponse:
        user = (
            self.session.query(models.User)
            .filter(models.User.email == payload.email)
            .one_or_none()
        )
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        self._sync_profile(user_id=user.id, last_seen_at=datetime.now(timezone.utc))

        token = create_access_token(user.id)
        return self._build_auth_response(user, token, token)

    def get_user_from_token(self, access_token: str) -> UserBase:
        from core.security import decode_token

        try:
            payload = decode_token(access_token)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token"
            ) from exc

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token"
            )

        user = self.session.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
            )

        return UserBase.model_validate(
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "createdAt": user.created_at,
            }
        )

    def get_profile(self, user_id: str) -> UserProfile:
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        total_trades = len(profile.user.trades)

        stmt = (
            select(func.count(func.distinct(models.Trade.market_id)))
            .join(models.Market, models.Trade.market_id == models.Market.id)
            .where(
                models.Trade.user_id == user_id,
                models.Market.status != models.MarketStatus.RESOLVED,
            )
        )
        open_positions = self.session.scalar(stmt) or 0

        realised_pnl = 0.0  # Placeholder until settlement logic exists

        return UserProfile.model_validate(
            {
                "id": profile.user.id,
                "email": profile.user.email,
                "role": profile.user.role,
                "displayName": profile.display_name,
                "wallet": profile.wallet,
                "joinedAt": profile.joined_at,
                "lastSeenAt": profile.last_seen_at,
                "totalTrades": total_trades,
                "openPositions": open_positions,
                "realisedPnL": round(realised_pnl, 2),
            }
        )

    def _sync_profile(
        self,
        user_id: str,
        *,
        display_name: Optional[str] = None,
        joined_at: Optional[datetime] = None,
        last_seen_at: Optional[datetime] = None,
    ) -> None:
        profile = (
            self.session.query(models.Profile)
            .filter(models.Profile.id == user_id)
            .first()
        )
        now_ts = datetime.now(timezone.utc)

        if profile:
            profile.last_seen_at = last_seen_at or now_ts
        else:
            user = self.session.get(models.User, user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
                )

            profile = models.Profile(
                id=user_id,
                display_name=display_name,
                joined_at=joined_at or now_ts,
                last_seen_at=last_seen_at or now_ts,
            )
            self.session.add(profile)
            user.profile = profile

        self.session.commit()

    def _build_auth_response(
        self, user, access_token: str, refresh_token: str
    ) -> AuthResponse:
        base = UserBase.model_validate(
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "createdAt": getattr(user, "created_at", None),
            }
        )
        tokens = AuthTokens.model_validate(
            {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "tokenType": "bearer",
            }
        )
        return AuthResponse(user=base, tokens=tokens)
