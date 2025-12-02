from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from core.config import settings

# Use Argon2 instead of bcrypt - no 72-byte limit and more secure
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using Argon2. No length limit."""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash. No length limit."""
    return pwd_context.verify(password, hashed)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.auth_access_token_expire_minutes)
    )
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(
        to_encode, settings.auth_secret_key, algorithm=settings.auth_algorithm
    )


def decode_token(token: str) -> Any:
    try:
        return jwt.decode(
            token, settings.auth_secret_key, algorithms=[settings.auth_algorithm]
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
