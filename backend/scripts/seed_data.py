#!/usr/bin/env python3
"""
Seed the SQLite database with sample markets and securities.
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timezone
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
            # ------------------------------------------------------------------
            # Ordered categorical markets
            # ------------------------------------------------------------------
            {
                "question": "What will be the peak temperature in NYC this summer (°F)?",
                "category": "Climate",
                "description": "Predict the highest temperature recorded in Central Park during June–August 2026.",
                "resolution_date": datetime(2026, 9, 1, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["weather", "temperature", "nyc", "climate"],
                "liquidity_parameter": 75000,
                "ui_type": "bars-ordered",
                "securities": [
                    {"outcome": "Below 90°F", "value": 85.0},
                    {"outcome": "90–95°F", "value": 92.5},
                    {"outcome": "95–100°F", "value": 97.5},
                    {"outcome": "100–105°F", "value": 102.5},
                    {"outcome": "Above 105°F", "value": 110.0},
                ],
            },
            {
                "question": "How many Atlantic named storms will form in the 2026 hurricane season?",
                "category": "Climate",
                "description": "Includes all named tropical cyclones in the Atlantic basin between June 1 and November 30, 2026.",
                "resolution_date": datetime(2026, 12, 1, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["hurricane", "climate", "weather", "noaa"],
                "liquidity_parameter": 70000,
                "ui_type": "bars-ordered",
                "securities": [
                    {"outcome": "1–10 storms", "value": 5.0},
                    {"outcome": "11–15 storms", "value": 13.0},
                    {"outcome": "16–20 storms", "value": 18.0},
                    {"outcome": "21–25 storms", "value": 23.0},
                    {"outcome": "26+ storms", "value": 28.0},
                ],
            },
            # ------------------------------------------------------------------
            # Temporal markets (when will X happen?)
            # ------------------------------------------------------------------
            {
                "question": "When will GPT-6 be publicly released?",
                "category": "Technology",
                "description": "Predict the month OpenAI publicly releases GPT-6 or an equivalent next-generation foundation model.",
                "resolution_date": datetime(2027, 7, 1, tzinfo=timezone.utc),
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
                "question": "In which month will the Federal Reserve first cut interest rates in 2026?",
                "category": "Economics",
                "description": "Resolves to the month of the first fed funds rate reduction announced at an FOMC meeting in 2026, or 'Not in 2026' if no cut occurs.",
                "resolution_date": datetime(2026, 12, 31, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["federal-reserve", "interest-rates", "economics", "fomc"],
                "liquidity_parameter": 80000,
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
                    "Not in 2026",
                ],
            },
            # ------------------------------------------------------------------
            # Day markets (exact calendar date)
            # ------------------------------------------------------------------
            {
                "question": "On what day will the S&P 500 first close above 7,000?",
                "category": "Economics",
                "description": "Resolves to the first calendar date on which the S&P 500 official closing price exceeds 7,000. If no such close occurs before April 1, 2026, resolves to the catch-all.",
                "resolution_date": datetime(2026, 4, 1, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["stocks", "s&p500", "equities"],
                "liquidity_parameter": 60000,
                "ui_type": "day",
                "securities": [
                    *[f"2026-02-{day:02d}" for day in range(1, 29)],
                    *[f"2026-03-{day:02d}" for day in range(1, 32)],
                    "Not before April 2026",
                ],
            },
            {
                "question": "On what day will the Supreme Court issue its last opinion of the 2025–2026 term?",
                "category": "Politics",
                "description": "The Supreme Court's term traditionally ends in late June or early July. Resolves to the date the final written opinion of the 2025–2026 term is published.",
                "resolution_date": datetime(2026, 7, 15, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["supreme-court", "law", "politics"],
                "liquidity_parameter": 50000,
                "ui_type": "day",
                "securities": [
                    # June 15 – June 30
                    *[f"2026-06-{day:02d}" for day in range(15, 31)],
                    # July 1 – July 14
                    *[f"2026-07-{day:02d}" for day in range(1, 15)],
                    # Last entry becomes the catch-all automatically
                    "Before June 15 or after July 14",
                ],
            },
            # ------------------------------------------------------------------
            # Interval markets (exact continuous measurements)
            # ------------------------------------------------------------------
            # {
            #     "question": "What will be the maximum temperature (°F) in Death Valley on July 15, 2026?",
            #     "category": "Climate",
            #     "description": "Predict the exact maximum temperature recorded at Furnace Creek, Death Valley on July 15, 2026. Use the slider to pick a precise value.",
            #     "resolution_date": datetime(2026, 7, 16, tzinfo=timezone.utc),
            #     "status": "open",
            #     "tags": ["weather", "temperature", "climate", "death-valley"],
            #     "liquidity_parameter": 100000,
            #     "ui_type": "interval",
            #     "securities": [
            #         {
            #             "outcome": f"{temp}°F",
            #             "value": float(temp),
            #             "is_catch_all": False,
            #         }
            #         for temp in range(100, 131)
            #     ]
            #     + [
            #         {
            #             "outcome": "Outside 100–130°F range",
            #             "value": 1e9,
            #             "is_catch_all": True,
            #         }
            #     ],
            # },
            {
                "question": "What will the US national average retail price for a dozen large eggs be in May, 2026?",
                "category": "Economics",
                "description": "Based on USDA Agricultural Marketing Service weekly retail egg price data. Resolves to the reported average for the last full week of May 2026.",
                "resolution_date": datetime(2026, 6, 1, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["eggs", "food", "inflation", "usda"],
                "liquidity_parameter": 60000,
                "ui_type": "interval",
                "securities": [
                    {
                        "outcome": f"${price / 100:.2f}",
                        "value": float(price) / 100,
                        "is_catch_all": False,
                    }
                    for price in range(200, 801, 10)
                ]
                + [
                    {
                        "outcome": "Outside $2.00–$8.00 range",
                        "value": 1e9,
                        "is_catch_all": True,
                    }
                ],
            },
            # {
            #     "question": "What will the US 30-year fixed mortgage rate be on September 1, 2026?",
            #     "category": "Economics",
            #     "description": "Based on the Freddie Mac Primary Mortgage Market Survey (PMMS) for the week containing September 1, 2026.",
            #     "resolution_date": datetime(2026, 9, 2, tzinfo=timezone.utc),
            #     "status": "open",
            #     "tags": ["mortgage", "housing", "interest-rates", "freddie-mac"],
            #     "liquidity_parameter": 80000,
            #     "ui_type": "interval",
            #     "securities": [
            #         {
            #             "outcome": f"{rate / 100:.2f}%",
            #             "value": float(rate) / 100,
            #             "is_catch_all": False,
            #         }
            #         for rate in range(500, 901, 25)
            #     ]
            #     + [
            #         {
            #             "outcome": "Outside 5.00%–9.00% range",
            #             "value": 1e9,
            #             "is_catch_all": True,
            #         }
            #     ],
            # },
            # {
            #     "question": "How many nonfarm payroll jobs (thousands) will the March 2026 BLS report show were added in February 2026?",
            #     "category": "Economics",
            #     "description": "Resolves to the initial (pre-revision) February 2026 figure from the Bureau of Labor Statistics Employment Situation report, released in early March 2026.",
            #     "resolution_date": datetime(2026, 3, 15, tzinfo=timezone.utc),
            #     "status": "open",
            #     "tags": ["jobs", "employment", "bls", "nonfarm-payrolls"],
            #     "liquidity_parameter": 70000,
            #     "ui_type": "interval",
            #     "securities": [
            #         {
            #             "outcome": (f"+{k}k" if k > 0 else f"{k}k"),
            #             "value": float(k),
            #             "is_catch_all": False,
            #         }
            #         for k in range(-200, 501, 25)
            #     ]
            #     + [
            #         {
            #             "outcome": "Outside −200k to +500k range",
            #             "value": 1e9,
            #             "is_catch_all": True,
            #         }
            #     ],
            # },
            # {
            #     "question": "What will the S&P 500 close at on December 31, 2026?",
            #     "category": "Economics",
            #     "description": "The official closing value of the S&P 500 index on the last trading day of 2026.",
            #     "resolution_date": datetime(2026, 12, 31, tzinfo=timezone.utc),
            #     "status": "open",
            #     "tags": ["stocks", "s&p500", "equities", "markets"],
            #     "liquidity_parameter": 150000,
            #     "ui_type": "interval",
            #     "securities": [
            #         {
            #             "outcome": str(price),
            #             "value": float(price),
            #             "is_catch_all": False,
            #         }
            #         for price in range(4500, 7501, 100)
            #     ]
            #     + [
            #         {
            #             "outcome": "Outside 4,500–7,500 range",
            #             "value": 1e9,
            #             "is_catch_all": True,
            #         }
            #     ],
            # },
            {
                "question": "What will the US CPI year-over-year inflation rate be in the March 2026 report (%)?",
                "category": "Economics",
                "description": "The Bureau of Labor Statistics releases the Consumer Price Index report in mid-April. Resolves to the headline (all items) year-over-year percentage for March 2026.",
                "resolution_date": datetime(2026, 4, 20, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["inflation", "cpi", "bls", "economics"],
                "liquidity_parameter": 80000,
                "ui_type": "interval",
                "securities": [
                    {
                        "outcome": f"{rate / 100:.2f}%",
                        "value": float(rate) / 100,
                        "is_catch_all": False,
                    }
                    for rate in range(50, 601, 10)
                ]
                + [
                    {
                        "outcome": "Outside 0.50%–6.00% range",
                        "value": 1e9,
                        "is_catch_all": True,
                    }
                ],
            },
            {
                "question": "What will be the highest temperature (°F) recorded in the continental US during summer 2026?",
                "category": "Climate",
                "description": "The all-time high recorded at any official NOAA weather station in the contiguous 48 states between June 1 and August 31, 2026.",
                "resolution_date": datetime(2026, 9, 1, tzinfo=timezone.utc),
                "status": "open",
                "tags": ["weather", "heat", "climate", "noaa"],
                "liquidity_parameter": 90000,
                "ui_type": "interval",
                "securities": [
                    {
                        "outcome": f"{temp}°F",
                        "value": float(temp),
                        "is_catch_all": False,
                    }
                    for temp in range(110, 136)
                ]
                + [
                    {
                        "outcome": "Outside 110–135°F range",
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
                legs=[{"security_id": sec.id, "quantity": qty} for sec, qty in legs],
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
