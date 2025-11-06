from functools import lru_cache
from typing import cast

from fastapi import HTTPException, status
from supabase import Client, create_client

from core.config import settings


class SupabaseNotConfigured(RuntimeError):
    """Raised when Supabase credentials are missing."""


@lru_cache
def get_supabase_client() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SupabaseNotConfigured(
            "Supabase credentials are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )
    return cast(Client, create_client(settings.supabase_url, settings.supabase_service_role_key))


def require_supabase_client() -> Client:
    try:
        return get_supabase_client()
    except SupabaseNotConfigured as exc:  # pragma: no cover - defensive guard
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase credentials missing. This endpoint requires database access.",
        ) from exc
