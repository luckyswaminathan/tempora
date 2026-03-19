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
    frontend_base_url: str = Field(
        default="http://localhost:3000", alias="FRONTEND_BASE_URL"
    )
    email_notifications_enabled: bool = Field(
        default=False, alias="EMAIL_NOTIFICATIONS_ENABLED"
    )
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="", alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")
    smtp_from_email: str = Field(
        default="no-reply@tempora.local", alias="SMTP_FROM_EMAIL"
    )
    smtp_from_name: str = Field(default="Tempora", alias="SMTP_FROM_NAME")

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
