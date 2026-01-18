from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from core.models import UserRole


class UserBase(BaseModel):
    id: str = Field(description="User UUID")
    email: EmailStr
    role: UserRole
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    display_name: Optional[str] = Field(default=None, alias="displayName")
    wallet: int
    joined_at: datetime = Field(alias="joinedAt")
    last_seen_at: Optional[datetime] = Field(default=None, alias="lastSeenAt")
    tutorial_completions: Optional[dict] = Field(
        default_factory=dict, alias="tutorialCompletions"
    )

    model_config = ConfigDict(populate_by_name=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=6, description="Minimum 6 characters per Supabase requirements"
    )
    display_name: Optional[str] = Field(default=None, alias="displayName")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthTokens(BaseModel):
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    token_type: Literal["bearer"] = Field(default="bearer", alias="tokenType")

    model_config = ConfigDict(populate_by_name=True)


class AuthResponse(BaseModel):
    user: UserBase
    tokens: AuthTokens


class UpdateTutorialRequest(BaseModel):
    lesson_key: str = Field(alias="lessonKey")
    completed: bool

    model_config = ConfigDict(populate_by_name=True)


class LeaderboardResponse(BaseModel):
    leaderboard: List[UserProfile]

    model_config = ConfigDict(populate_by_name=True)
