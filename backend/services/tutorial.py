from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core import models
from schemas.user import UserProfile


class TutorialService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def update_tutorial_completion(
        self, user_id: str, lesson_key: str, completed: bool
    ) -> UserProfile:
        profile = self.session.get(models.Profile, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        profile.tutorial_completions[lesson_key] = completed
        self.session.commit()
        self.session.refresh(profile)

        return UserProfile.model_validate(
            {
                "id": profile.user.id,
                "email": profile.user.email,
                "role": profile.user.role,
                "displayName": profile.display_name,
                "wallet": profile.wallet,
                "joinedAt": profile.joined_at,
                "lastSeenAt": profile.last_seen_at,
                "tutorialCompletions": profile.tutorial_completions,
            }
        )
