from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    id: str = Field(description="Supabase Auth user UUID")
    email: EmailStr
    display_name: Optional[str] = Field(default=None, alias="displayName")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, description="Minimum 6 characters per Supabase requirements")
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


class UserProfile(BaseModel):
    id: str
    email: EmailStr
    display_name: Optional[str] = Field(default=None, alias="displayName")
    joined_at: datetime = Field(alias="joinedAt")
    last_seen_at: Optional[datetime] = Field(default=None, alias="lastSeenAt")
    total_trades: int = Field(default=0, alias="totalTrades")
    open_positions: int = Field(default=0, alias="openPositions")
    realised_pnl: float = Field(default=0.0, alias="realisedPnL")

    model_config = ConfigDict(populate_by_name=True)
