#!/usr/bin/env python3
"""
Seed the SQLite database with sample markets and securities.
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from math import log as math_log
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import models  # noqa: E402
from core.database import SessionLocal, init_db  # noqa: E402
from utils.pricing import _lmsr_price_cents  # noqa: E402


def _compute_initial_funding_cents(liquidity_parameter: float, n_outcomes: int) -> int:
    """
    LMSR worst-case market-maker loss = b * ln(n).
    Returns that amount in cents (stored as initial_funding_cents on Market).
    """
    return round(100 * liquidity_parameter * math_log(n_outcomes))


def seed_markets() -> None:
    session = SessionLocal()
    try:
        markets = [
            {
                "question": "When will the US enter a recession?",
                "category": "Economics",
                "description": "A recession is defined as two consecutive quarters of negative GDP growth.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=730),
                "status": "open",
                "tags": ["macroeconomics", "economy", "us"],
                "liquidity_parameter": 100000,
                "ui_type": "quarter",
                "securities": [
                    "2026 Q1",
                    "2026 Q2",
                    "2026 Q3",
                    "2026 Q4",
                    "2027 Q1",
                    "2027 Q2",
                    "2027 Q3",
                    "Later or never",
                ],
            },
            {
                "question": "When will Bitcoin reach $150,000?",
                "category": "Technology",
                "description": "Bitcoin price must reach or exceed $150,000 USD before January 1, 2026.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=365),
                "status": "open",
                "tags": ["cryptocurrency", "bitcoin", "crypto"],
                "liquidity_parameter": 100000,
                "ui_type": "quarter",
                "securities": [
                    "2026 Q1",
                    "2026 Q2",
                    "2026 Q3",
                    "2026 Q4",
                    "2027 Q1",
                    "2027 Q2",
                    "2027 Q3",
                    "Later or never",
                ],
            },
            {
                "question": "When will the next Constitutional amendment be ratified?",
                "category": "Politics",
                "description": "",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=365),
                "status": "open",
                "tags": ["constitution", "congress", "law"],
                "liquidity_parameter": 100000,
                "ui_type": "year",
                "securities": [
                    "2026",
                    "2027",
                    "2028",
                    "2029",
                    "2030",
                    "2031",
                    "2032",
                    "Later or never",
                ],
            },
            {
                "question": "When will GPT-5 be released?",
                "category": "Technology",
                "description": "Official release date of GPT-5 or equivalent next-generation model from OpenAI.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=730),
                "status": "open",
                "tags": ["ai", "openai", "gpt", "technology"],
                "liquidity_parameter": 100000,
                "ui_type": "month",
                "securities": [
                    "2026-01",
                    "2026-02",
                    "2026-03",
                    "2026-04",
                    "2026-05",
                    "2026-06",
                    "2026-07",
                    "2026-08",
                    "2026-09",
                    "2026-10",
                    "2026-11",
                    "2026-12",
                    "2027-01",
                    "2027-02",
                    "2027-03",
                    "2027-04",
                    "2027-05",
                    "2027-06",
                    "Later or never",
                ],
            },
            {
                "question": "What day will the next Federal Reserve rate decision be announced?",
                "category": "Economics",
                "description": "The Federal Reserve announces interest rate decisions at scheduled FOMC meetings. Predict the exact day of the next announcement in February 2026.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=60),
                "status": "open",
                "tags": ["federal-reserve", "interest-rates", "economics", "fed"],
                "liquidity_parameter": 50000,
                "ui_type": "day",
                "securities": [
                    "2026-02-01",
                    "2026-02-02",
                    "2026-02-03",
                    "2026-02-04",
                    "2026-02-05",
                    "2026-02-06",
                    "2026-02-07",
                    "2026-02-08",
                    "2026-02-09",
                    "2026-02-10",
                    "2026-02-11",
                    "2026-02-12",
                    "2026-02-13",
                    "2026-02-14",
                    "2026-02-15",
                    "2026-02-16",
                    "2026-02-17",
                    "2026-02-18",
                    "2026-02-19",
                    "2026-02-20",
                    "2026-02-21",
                    "2026-02-22",
                    "2026-02-23",
                    "2026-02-24",
                    "2026-02-25",
                    "2026-02-26",
                    "2026-02-27",
                    "2026-02-28",
                    "Later or never",
                ],
            },
            {
                "question": "What will be the peak temperature in NYC this summer (°F)?",
                "category": "Climate",
                "description": "Predict the highest temperature recorded in Central Park during June-August 2026.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=180),
                "status": "open",
                "tags": ["weather", "temperature", "nyc"],
                "liquidity_parameter": 75000,
                "ui_type": "bars-ordered",
                "securities": [
                    {"outcome": "Below 90°F", "value": 85.0},
                    {"outcome": "90-95°F", "value": 92.5},
                    {"outcome": "95-100°F", "value": 97.5},
                    {"outcome": "100-105°F", "value": 102.5},
                    {"outcome": "Above 105°F", "value": 110},
                ],
            },
            {
                "question": "Who will win the 2026 World Cup?",
                "category": "Sports",
                "description": "Predict which country will win the FIFA World Cup 2026.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=365),
                "status": "open",
                "tags": ["sports", "soccer", "worldcup"],
                "liquidity_parameter": 150000,
                "ui_type": "bars-categorical",
                "securities": [
                    "Brazil",
                    "Argentina",
                    "France",
                    "Germany",
                    "Spain",
                    "England",
                    "Other",
                ],
            },
            {
                "question": "What will be the maximum temperature (°F) in Death Valley on July 15, 2026?",
                "category": "Climate",
                "description": "Predict the exact maximum temperature recorded in Death Valley, California on July 15, 2026. Use the interval slider to select a temperature range.",
                "resolution_date": datetime.now(timezone.utc) + timedelta(days=180),
                "status": "open",
                "tags": ["weather", "temperature", "climate"],
                "liquidity_parameter": 100000,
                "ui_type": "interval",
                "securities": [
                    {
                        "outcome": f"{temp}°F",
                        "value": float(temp),
                        "is_catch_all": False,
                    }
                    for temp in range(100, 131)
                ]
                + [
                    {
                        "outcome": "Outside 100-130°F range",
                        "value": 1e9,
                        "is_catch_all": True,
                    }
                ],
            },
        ]

        from core.security import hash_password

        # ---------------------------------------------------------------------------
        # Admin user
        # ---------------------------------------------------------------------------
        admin_user = (
            session.query(models.User)
            .filter(models.User.email == "admin@tempora.com")
            .first()
        )
        if not admin_user:
            admin_user = models.User(
                email="admin@tempora.com",
                role=models.UserRole.ADMIN,
                password_hash=hash_password("admin12345"),
                created_at=datetime.now(timezone.utc),
            )
            session.add(admin_user)
            session.flush()
            session.add(
                models.Profile(
                    id=admin_user.id,
                    display_name="Admin",
                    # Large enough wallet to cover all seeded trades without needing
                    # to be recalculated; real value will drift as trades are added.
                    wallet=100_000_00,  # $100,000
                    joined_at=datetime.now(timezone.utc),
                )
            )
            session.flush()

        admin_profile = session.get(models.Profile, admin_user.id)

        # ---------------------------------------------------------------------------
        # Market-maker user
        # ---------------------------------------------------------------------------
        # Pre-compute total funding collateral so we can initialise the wallet.
        def _count_outcomes(mkt: dict) -> int:
            return len(mkt["securities"])

        total_initial_funding = sum(
            _compute_initial_funding_cents(
                mkt["liquidity_parameter"], _count_outcomes(mkt)
            )
            for mkt in markets
        )

        mm_user = (
            session.query(models.User)
            .filter(models.User.email == "mm@tempora.com")
            .first()
        )
        if not mm_user:
            mm_user = models.User(
                email="mm@tempora.com",
                role=models.UserRole.MARKET_MAKER,
                password_hash=hash_password("mm12345"),
                created_at=datetime.now(timezone.utc),
            )
            session.add(mm_user)
            session.flush()
            session.add(
                models.Profile(
                    id=mm_user.id,
                    display_name="Market Maker",
                    wallet=10_000_00 + total_initial_funding,
                    joined_at=datetime.now(timezone.utc),
                )
            )
            session.flush()

        mm_profile = session.get(models.Profile, mm_user.id)

        # ---------------------------------------------------------------------------
        # Markets
        # ---------------------------------------------------------------------------
        for market in markets:
            # Parse outcomes first so we know n (needed for funding collateral).
            parsed_outcomes: list[dict] = []
            for outcome in market["securities"]:
                if isinstance(outcome, str):
                    parsed_outcomes.append(
                        {"outcome": outcome, "value": None, "is_catch_all": False}
                    )
                else:
                    parsed_outcomes.append(dict(outcome))

            # Auto-assign sequential numeric values when none are provided.
            has_values = any(o["value"] is not None for o in parsed_outcomes)
            if not has_values:
                for i, outcome in enumerate(parsed_outcomes, start=1):
                    if i < len(parsed_outcomes):
                        outcome["value"] = float(i)
                        outcome["is_catch_all"] = False
                    else:
                        outcome["value"] = 1e9
                        outcome["is_catch_all"] = True

            n_outcomes = len(parsed_outcomes)
            b = market["liquidity_parameter"]
            initial_funding_cents = _compute_initial_funding_cents(b, n_outcomes)

            m = models.Market(
                question=market["question"],
                category=market["category"],
                description=market["description"],
                resolution_date=market["resolution_date"],
                status=market["status"],
                tags=market["tags"],
                liquidity_parameter=b,
                ui_type=market["ui_type"],
                # Market is owned by the market-maker; their initial_funding_cents
                # is locked adaptively against their wallet via get_user_collateral_locked().
                creator_id=mm_user.id,
                initial_funding_cents=initial_funding_cents,
            )
            session.add(m)
            session.flush()

            # Create security rows.
            securities: list[models.Security] = []
            for outcome_data in parsed_outcomes:
                sec = models.Security(
                    market_id=m.id,
                    outcome=outcome_data["outcome"],
                    value=outcome_data["value"],
                    is_catch_all=outcome_data.get("is_catch_all", False),
                    created_at=datetime.now(timezone.utc),
                )
                session.add(sec)
                securities.append(sec)
            session.flush()

            # ------------------------------------------------------------------
            # Seed initial trades using correct LMSR pricing.
            #
            # All legs are placed under a SINGLE order so that the history
            # service (which records one probability point per completed order)
            # produces exactly one history point after the full batch.  This
            # avoids the chart artefact where early per-outcome orders
            # temporarily depress the viewed security's probability.
            # ------------------------------------------------------------------
            quantities: dict[str, float] = {sec.id: 0.0 for sec in securities}

            random.seed(m.id)  # Deterministic per market.

            # Determine quantities first, then create one order for the batch.
            legs: list[tuple[models.Security, int]] = []
            for i, sec in enumerate(securities):
                base_qty = random.randint(10, 50)

                if "Later" in sec.outcome or "never" in sec.outcome:
                    qty = random.randint(5, 20)
                elif i < len(securities) // 3:
                    qty = base_qty + random.randint(10, 30)
                elif i < 2 * len(securities) // 3:
                    qty = base_qty
                else:
                    qty = max(1, base_qty - random.randint(5, 15))

                legs.append((sec, qty))

            # One order for all seeded trades in this market.
            seed_order = models.Order(
                user_id=admin_user.id,
                market_id=m.id,
                type=models.OrderType.MARKET,
                filled=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(seed_order)
            session.flush()

            total_price = 0
            for sec, qty in legs:
                # True LMSR cost for buying `qty` units given current state.
                price = _lmsr_price_cents(quantities, {sec.id: float(qty)}, b)

                trade = models.Trade(
                    order_id=seed_order.id,
                    user_id=admin_user.id,
                    security_id=sec.id,
                    quantity=qty,
                    price_cents=price,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(trade)

                # Advance the LMSR state for subsequent legs.
                quantities[sec.id] += float(qty)
                total_price += price

            # Keep wallet balances consistent: admin pays, market maker receives.
            admin_profile.wallet -= total_price
            mm_profile.wallet += total_price

        session.commit()
        print(
            f"Seeded {len(markets)} markets.\n"
            f"  Market-maker funding collateral: ${total_initial_funding / 100:,.2f}\n"
            f"  Admin wallet after seeding:      ${admin_profile.wallet / 100:,.2f}\n"
            f"  Market-maker wallet after seeding: ${mm_profile.wallet / 100:,.2f}"
        )
    finally:
        session.close()


def main() -> None:
    init_db()
    seed_markets()


if __name__ == "__main__":
    main()
