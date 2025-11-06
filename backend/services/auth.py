from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from supabase import Client

from schemas.user import (
    AuthResponse,
    AuthTokens,
    LoginRequest,
    RegisterRequest,
    UserBase,
    UserProfile,
)


class AuthService:
    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase

    def register(self, payload: RegisterRequest) -> AuthResponse:
        try:
            response = self.supabase.auth.sign_up(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "options": {"data": {"display_name": payload.display_name}},
                }
            )
        except Exception as exc:  # pragma: no cover - direct supabase client error passthrough
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        if not response.user or not response.session:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create user")

        self._sync_profile(
            user_id=response.user.id,
            email=response.user.email or payload.email,
            display_name=payload.display_name,
            joined_at=datetime.now(timezone.utc),
        )

        return self._build_auth_response(response.user, response.session.access_token, response.session.refresh_token)

    def login(self, payload: LoginRequest) -> AuthResponse:
        try:
            response = self.supabase.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

        if not response.user or not response.session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        self._sync_profile(
            user_id=response.user.id,
            email=response.user.email or payload.email,
            display_name=self._display_name_from_metadata(response.user.user_metadata),
            last_seen_at=datetime.now(timezone.utc),
        )

        return self._build_auth_response(response.user, response.session.access_token, response.session.refresh_token)

    def get_user_from_token(self, access_token: str) -> UserBase:
        try:
            result = self.supabase.auth.get_user(access_token)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc

        if not result.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        return UserBase.model_validate(
            {
                "id": result.user.id,
                "email": result.user.email,
                "displayName": self._display_name_from_metadata(result.user.user_metadata),
                "createdAt": result.user.created_at,
            }
        )

    def get_profile(self, user_id: str) -> UserProfile:
        response = self.supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        profile = response.data
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

        trades = (
            self.supabase.table("trades")
            .select("market_id, stake, side")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )

        total_trades = len(trades)
        open_positions = len({trade["market_id"] for trade in trades})
        realised_pnl = 0.0  # Placeholder until settlement logic exists

        mapped = {
            "id": profile["id"],
            "email": profile.get("email"),
            "displayName": profile.get("display_name"),
            "joinedAt": profile.get("joined_at"),
            "lastSeenAt": profile.get("last_seen_at"),
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
        display_name: Optional[str],
        joined_at: Optional[datetime] = None,
        last_seen_at: Optional[datetime] = None,
    ) -> None:
        profile_payload = {
            "id": user_id,
            "email": email,
            "display_name": display_name,
            "joined_at": (joined_at or datetime.now(timezone.utc)).isoformat(),
            "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
        }
        self.supabase.table("profiles").upsert(profile_payload).execute()

    def _display_name_from_metadata(self, metadata: Optional[dict]) -> Optional[str]:
        if not metadata:
            return None
        return metadata.get("display_name")

    def _build_auth_response(self, user, access_token: str, refresh_token: str) -> AuthResponse:
        base = UserBase.model_validate(
            {
                "id": user.id,
                "email": user.email,
                "displayName": self._display_name_from_metadata(user.user_metadata),
                "createdAt": user.created_at,
            }
        )
        tokens = AuthTokens.model_validate(
            {"accessToken": access_token, "refreshToken": refresh_token, "tokenType": "bearer"}
        )
        return AuthResponse(user=base, tokens=tokens)
