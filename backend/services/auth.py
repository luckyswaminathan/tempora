from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
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
            display_name=payload.display_name,
            created_at=datetime.now(timezone.utc),
        )
        profile = models.Profile(
            id=user_id,
            email=payload.email,
            display_name=payload.display_name,
            joined_at=datetime.now(timezone.utc),
            last_seen_at=None,
        )
        user.profile = profile
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

        self._sync_profile(
            user_id=user.id,
            email=user.email,
            role=user.role,
            display_name=user.display_name,
            last_seen_at=datetime.now(timezone.utc),
        )

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
                "displayName": user.display_name,
                "createdAt": user.created_at,
            }
        )

    def get_profile(self, user_id: str) -> UserProfile:
        profile = (
            self.session.query(models.Profile)
            .filter(models.Profile.id == user_id)
            .first()
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
            )

        trades = (
            self.session.query(models.Trade)
            .filter(models.Trade.user_id == user_id)
            .all()
        )

        total_trades = len(trades)
        open_positions = len({trade.market_id for trade in trades})
        realised_pnl = 0.0  # Placeholder until settlement logic exists

        mapped = {
            "id": profile.id,
            "email": profile.email,
            "role": profile.role,
            "displayName": profile.display_name,
            "joinedAt": profile.joined_at,
            "lastSeenAt": profile.last_seen_at,
            "totalTrades": total_trades,
            "openPositions": open_positions,
            "realisedPnL": round(realised_pnl, 2),
        }
        return UserProfile.model_validate(mapped)

    def _sync_profile(
        self,
        *,
        user_id: str,
        email: str,
        role: str,
        display_name: Optional[str],
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
            profile.email = email
            profile.role = role
            profile.display_name = display_name
            profile.last_seen_at = last_seen_at or now_ts
        else:
            profile = models.Profile(
                id=user_id,
                email=email,
                role=role,
                display_name=display_name,
                joined_at=joined_at or now_ts,
                last_seen_at=last_seen_at,
            )
            self.session.add(profile)
        user = self.session.get(models.User, user_id)
        if user:
            user.display_name = display_name or user.display_name
        self.session.commit()

    def _build_auth_response(
        self, user, access_token: str, refresh_token: str
    ) -> AuthResponse:
        base = UserBase.model_validate(
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "displayName": user.display_name,
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
