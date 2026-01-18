from fastapi import APIRouter, Body, Depends, status
from pydantic import BaseModel

from api import deps
from schemas.user import AuthResponse, LoginRequest, RegisterRequest, UserBase
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
    """Sync user profile after signup/login."""
    auth_service._sync_profile(
        user_id=current_user.id,
        display_name=payload.displayName,
        joined_at=None,
        last_seen_at=None,
    )
    return {"status": "ok"}


@router.post(
    "/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
def register_user(
    payload: RegisterRequest,
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> AuthResponse:
    return auth_service.register(payload)


@router.post("/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def login_user(
    payload: LoginRequest,
    auth_service: AuthService = Depends(deps.get_auth_service),
) -> AuthResponse:
    return auth_service.login(payload)


@router.get("/me", response_model=UserBase)
def get_current_user(user: UserBase = Depends(deps.get_current_user)) -> UserBase:
    return user
