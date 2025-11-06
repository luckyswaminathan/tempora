from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = Field(default="development", alias="ENVIRONMENT")
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: str | None = Field(default=None, alias="SUPABASE_ANON_KEY")
    cors_allow_origins: str = Field(default="*", alias="CORS_ALLOW_ORIGINS")
    pricing_baseline: float = Field(default=50.0, alias="PRICING_BASELINE")
    pricing_sensitivity: float = Field(default=0.045, alias="PRICING_SENSITIVITY")
    pricing_floor: float = Field(default=5.0, alias="PRICING_FLOOR")
    pricing_ceiling: float = Field(default=95.0, alias="PRICING_CEILING")

    model_config = SettingsConfigDict(
        env_file=(".env",),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_allow_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if not self.cors_allow_origins:
            return ["*"]
        items = [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]
        return items or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
