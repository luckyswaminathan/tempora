from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session
from core import models
from schemas.user import LeaderboardResponse


class LeaderboardService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_leaderboard(self, limit: int) -> LeaderboardResponse:
        stmt = (
            select(models.User)
            .join(models.Profile)
            .order_by(models.Profile.wallet.desc())
            .limit(limit)
        )

        users = [
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "displayName": user.profile.display_name,
                "wallet": user.profile.wallet,
                "joinedAt": user.profile.joined_at,
                "lastSeenAt": user.profile.last_seen_at,
            }
            for user in self.session.scalars(stmt).all()
        ]

        return LeaderboardResponse.model_validate({"leaderboard": users})
