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


class MarketBase:
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    liquidity_parameter: Mapped[float | None] = mapped_column(Float, nullable=True)
    ui_type: Mapped[str] = mapped_column(String, nullable=False, default="bars-ordered")


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
    MARKET_MAKER = "market_maker"
    ADMIN = "admin"


class OrderType(StrEnum):
    MARKET = "market"
    LIMIT = "limit"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(
        Enum(UserRole), default=UserRole.USER, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    profile: Mapped["Profile"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


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


class Market(MarketBase, Base):
    __tablename__ = "markets"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    creator_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum(MarketStatus), nullable=False, default=MarketStatus.OPEN
    )
    initial_funding_cents: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    winning_security_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    creator: Mapped[User] = relationship(foreign_keys=[creator_id])
    securities: Mapped[List["Security"]] = relationship(
        back_populates="market", cascade="all, delete-orphan", viewonly=True
    )


class Security(Base):
    __tablename__ = "securities"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    market_id: Mapped[str] = mapped_column(
        String, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False
    )
    outcome: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    is_catch_all: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    market: Mapped[Market] = relationship(back_populates="securities")
    trades: Mapped[List["Trade"]] = relationship(
        back_populates="security", viewonly=True
    )

    __table_args__ = (UniqueConstraint("id", "market_id", name="uq_security_market"),)


class MarketProposal(MarketBase, Base):
    __tablename__ = "market_proposals"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    proposer_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    outcomes: Mapped[list[dict]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
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


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    type: Mapped[str] = mapped_column(
        Enum(OrderType), nullable=False, default=OrderType.MARKET
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    market_id: Mapped[str] = mapped_column(
        String, ForeignKey("markets.id"), nullable=False, index=True
    )
    legs: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    limit_price_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    collateral_locked_cents: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    filled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canceled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[User] = relationship()
    market: Mapped[Market] = relationship()
    trades: Mapped[List["Trade"]] = relationship(back_populates="order", viewonly=True)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    order_id: Mapped[str] = mapped_column(
        String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    security_id: Mapped[str] = mapped_column(
        String, ForeignKey("securities.id"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    order: Mapped[Order] = relationship(back_populates="trades")
    user: Mapped[User] = relationship()
    security: Mapped[Security] = relationship(back_populates="trades")


class PlatformState(Base):
    __tablename__ = "platform_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    current_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class SettlementTodo(Base):
    __tablename__ = "settlement_todos"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid4())
    )
    market_id: Mapped[str] = mapped_column(
        String, ForeignKey("markets.id"), nullable=False, unique=True
    )
    market_maker_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    settled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    market: Mapped[Market] = relationship()
    market_maker: Mapped[User] = relationship()
