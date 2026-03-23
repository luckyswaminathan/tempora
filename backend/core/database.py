from __future__ import annotations

from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from core.config import settings


class Base(DeclarativeBase):
    """Declarative base class for SQLAlchemy models."""


def _ensure_sqlite_parent_dir(database_url: URL) -> None:
    """Create parent directory for SQLite file URLs."""
    if database_url.drivername.startswith("sqlite") and database_url.database not in (
        None,
        "",
        ":memory:",
    ):
        db_path = Path(database_url.database)
        if not db_path.is_absolute():
            db_path = Path.cwd() / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)


def create_engine_from_url(url: str | URL, *, echo: bool = False):
    """Create an engine from a URL string while handling SQLite quirks."""
    db_url = make_url(str(url))
    connect_args = {}
    if db_url.drivername.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        _ensure_sqlite_parent_dir(db_url)
    return create_engine(db_url, echo=echo, future=True, connect_args=connect_args)


engine = create_engine_from_url(settings.database_url, echo=settings.database_echo)
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, expire_on_commit=False, bind=engine
)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create database tables if they do not exist."""
    from core import models  # Import models for metadata registration

    Base.metadata.create_all(bind=engine)

    # Lightweight schema backfill for SQLite where create_all does not add columns.
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "profiles" in inspector.get_table_names():
            profile_columns = {col["name"] for col in inspector.get_columns("profiles")}
            if "email_notifications_enabled" not in profile_columns:
                conn.execute(
                    text(
                        "ALTER TABLE profiles "
                        "ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
        if "orders" in inspector.get_table_names():
            order_columns = {col["name"] for col in inspector.get_columns("orders")}
            if "expires_at" not in order_columns:
                conn.execute(text("ALTER TABLE orders ADD COLUMN expires_at DATETIME"))
