from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = Field(default="development", alias="ENVIRONMENT")
    database_url: str = Field(
        default="sqlite:///./.data/sqlite/tempora.db", alias="DATABASE_URL"
    )
    database_echo: bool = Field(default=False, alias="DATABASE_ECHO")
    auth_secret_key: str = Field(default="change-me", alias="AUTH_SECRET_KEY")
    auth_algorithm: str = Field(default="HS256", alias="AUTH_ALGORITHM")
    auth_access_token_expire_minutes: int = Field(
        default=60 * 24, alias="AUTH_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    cors_allow_origins: str = Field(default="*", alias="CORS_ALLOW_ORIGINS")
    starting_amount: int = Field(default="100000", alias="STARTING_AMOUNT")

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
        items = [
            origin.strip()
            for origin in self.cors_allow_origins.split(",")
            if origin.strip()
        ]
        return items or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
