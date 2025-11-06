from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel

from api import deps
from schemas.user import UserBase
from services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class SyncProfileRequest(BaseModel):
    displayName: str | None = None


@router.post("/sync-profile")
def sync_profile(
    payload: SyncProfileRequest = Body(...),
    auth_service: AuthService = Depends(deps.get_auth_service),
    current_user: UserBase = Depends(deps.get_current_user),
) -> dict[str, str]:
    """Sync user profile after Supabase auth signup/login."""
    auth_service._sync_profile(
        user_id=current_user.id,
        email=current_user.email,
        display_name=payload.displayName,
        joined_at=None,
        last_seen_at=None,
    )
    return {"status": "ok"}


@router.get("/me", response_model=UserBase)
def get_current_user(user: UserBase = Depends(deps.get_current_user)) -> UserBase:
    return user
