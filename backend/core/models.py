from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import List
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.mutable import MutableDict

from core.config import settings
from core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MarketStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    RESOLVED = "resolved"
    SUSPENDED = "suspended"


class ProposalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    LIVE = "live"


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(
        Enum(UserRole),
        default=UserRole.ADMIN if settings.environment == "test" else UserRole.USER,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_market_maker: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    profile: Mapped["Profile"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    trades: Mapped[List["Trade"]] = relationship(back_populates="user", viewonly=True)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    wallet: Mapped[int] = mapped_column(
        Integer, default=settings.starting_amount, nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tutorial_completions: Mapped[dict] = mapped_column(
        MutableDict.as_mutable(JSON),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    user: Mapped[User] = relationship(back_populates="profile", viewonly=True)


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum(MarketStatus), nullable=False, default=MarketStatus.OPEN
    )
    resolution_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    liquidity_parameter: Mapped[float | None] = mapped_column(Float, nullable=True)
    interval_granularity: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    securities: Mapped[List["Security"]] = relationship(
        back_populates="market", cascade="all, delete-orphan", viewonly=True
    )
    trades: Mapped[List["Trade"]] = relationship(viewonly=True)


class Security(Base):
    __tablename__ = "securities"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    market_id: Mapped[str] = mapped_column(
        String, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False
    )
    outcome: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    market: Mapped[Market] = relationship(back_populates="securities")
    trades: Mapped[List["Trade"]] = relationship(
        back_populates="security", viewonly=True
    )

    __table_args__ = (UniqueConstraint("id", "market_id", name="uq_security_market"),)


class MarketProposal(Base):
    __tablename__ = "market_proposals"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    proposer_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    outcomes: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    liquidity_parameter: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(ProposalStatus), nullable=False, default=ProposalStatus.PENDING
    )
    reviewer_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_market_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("markets.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    proposer: Mapped[User] = relationship(foreign_keys=[proposer_id])
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewer_id])
    created_market: Mapped[Market | None] = relationship()


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    market_id: Mapped[str] = mapped_column(
        String, ForeignKey("markets.id"), nullable=False, index=True
    )
    trade_group_id: Mapped[str] = mapped_column(
        String, nullable=False, default=lambda: str(uuid4())
    )
    security_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[User] = relationship(back_populates="trades")
    market: Mapped[Market] = relationship(viewonly=True)
    security: Mapped[Security] = relationship(back_populates="trades")

    __table_args__ = (
        ForeignKeyConstraint(
            ["market_id", "security_id"],
            ["securities.market_id", "securities.id"],
            ondelete="CASCADE",
            name="fk_trades_security_in_market",
        ),
    )
