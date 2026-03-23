#!/usr/bin/env python3
"""
Seed the SQLite database with sample markets and securities.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from math import log as math_log, exp as math_exp, sin as math_sin, pi as math_pi
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import models  # noqa: E402
from core.database import SessionLocal, init_db  # noqa: E402
from services.history import HistoryService  # noqa: E402
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
        history_service = HistoryService(session)

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
                    wallet=5_000_00,  # $5,000
                    joined_at=datetime.now(timezone.utc),
                )
            )
            session.flush()

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
        # Trader user  (opinionated, non-admin demo account)
        # ---------------------------------------------------------------------------
        trader_user = (
            session.query(models.User)
            .filter(models.User.email == "trader@tempora.com")
            .first()
        )
        if not trader_user:
            trader_user = models.User(
                email="trader@tempora.com",
                role=models.UserRole.USER,
                password_hash=hash_password("trader12345"),
                created_at=datetime.now(timezone.utc),
            )
            session.add(trader_user)
            session.flush()
            session.add(
                models.Profile(
                    id=trader_user.id,
                    display_name="Trader",
                    wallet=75_000_00,
                    joined_at=datetime.now(timezone.utc),
                )
            )
            session.flush()

        trader_profile = session.get(models.Profile, trader_user.id)

        # ---------------------------------------------------------------------------
        # Markets
        # ---------------------------------------------------------------------------
        # Collect DB market objects so we can place trader positions afterwards.
        seeded_db_markets: list[models.Market] = []

        for market in markets:
            market_created_at = datetime.now(timezone.utc) - timedelta(hours=6)

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
                created_at=market_created_at,
                updated_at=market_created_at,
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
                    created_at=market_created_at,
                )
                session.add(sec)
                securities.append(sec)
            session.flush()

            seeded_db_markets.append(m)

        # ---------------------------------------------------------------------------
        # Trader positions  (opinionated, concentrated bets placed after the
        # initial liquidity exists so prices are already meaningful)
        # ---------------------------------------------------------------------------
        # Each entry: (question_substring, [(outcome_substring, qty), ...], short)
        # short=True means selling (negative quantity)
        trader_positions: list[tuple[str, list[tuple[str, int]]]] = [
            # NYC peak temp: long extreme heat, short mild end
            (
                "peak temperature in NYC",
                [
                    ("Below 90", -2500),  # short – very unlikely given trends
                    ("90–95", -2000),  # short – below trader's expected range
                    ("95–100", 3500),  # core long
                    ("100–105", 3000),  # core long
                    ("Above 105", 1500),  # tail long – heat dome risk
                ],
            ),
            # Hurricane season: bullish on very active season, short quiet outcomes
            (
                "Atlantic named storms",
                [
                    ("1–10", -2500),  # short – historically unlikely
                    ("11–15", -2000),  # short – below average
                    ("16–20", 1500),  # long – average range
                    ("21–25", 3500),  # core long
                    ("26+", 2500),  # long – very active tail
                ],
            ),
            # GPT-6: expects H2 2026 – Q1 2027, short "never"
            (
                "GPT-6",
                [
                    ("2026-07", 1500),
                    ("2026-08", 2000),
                    ("2026-09", 2500),
                    ("2026-10", 2500),
                    ("2026-11", 2000),
                    ("2026-12", 1500),
                    ("2027-01", 2000),
                    ("2027-02", 2000),
                    ("2027-03", 1500),
                    ("Later or never", -2500),  # short – trader confident it's coming
                ],
            ),
            # Fed cut: expects Sep or Nov 2026, short early cuts and no-cut
            (
                "Federal Reserve first cut",
                [
                    ("2026-03", -1500),  # short – too soon, data not there
                    ("2026-04", -1500),  # short – too soon
                    ("2026-05", -1000),  # short – unlikely
                    ("2026-07", 1500),  # modest long – plausible
                    ("2026-09", 3500),  # core long
                    ("2026-11", 2500),  # core long
                    ("Not in 2026", -2000),  # short – trader expects at least one cut
                ],
            ),
            # S&P 500 first close >7000: expects late March or not before April
            (
                "S&P 500 first close above 7,000",
                [
                    ("2026-03-23", 1500),
                    ("2026-03-24", 2000),
                    ("2026-03-25", 2500),
                    ("2026-03-26", 2500),
                    ("2026-03-27", 2000),
                    ("2026-03-28", 1500),
                    ("Not before April 2026", 3000),
                ],
            ),
            # Supreme Court last opinion: expects June 26–30, short early/late outliers
            (
                "Supreme Court",
                [
                    ("Before June 15", -2000),  # short the catch-all
                    ("2026-06-15", -1500),  # short – historically early
                    ("2026-06-16", -1500),
                    ("2026-06-24", 1500),
                    ("2026-06-25", 2000),
                    ("2026-06-26", 3000),
                    ("2026-06-27", 3000),
                    ("2026-06-28", 2500),
                    ("2026-06-29", 2000),
                    ("2026-06-30", 1500),
                ],
            ),
            # Eggs: big peak (~$3.50) then big valley (~$6.50) – one full sine cycle
            # across the entire $2.00–$8.00 interval for a dramatic peak-then-trough shape
            (
                "dozen large eggs",
                [
                    (
                        f"${price / 100:.2f}",
                        round(8000 * math_sin(2 * math_pi * (price / 100 - 2.0) / 6.0)),
                    )
                    for price in range(200, 801, 10)
                ],
            ),
            # CPI: unimodal – dense Gaussian bell centred at 3.00%, σ ≈ 0.4%
            # Every outcome is traded so the curve is perfectly smooth
            (
                "CPI year-over-year",
                [
                    (
                        f"{rate / 100:.2f}%",
                        round(12000 * math_exp(-0.5 * ((rate / 100 - 3.0) / 0.4) ** 2)),
                    )
                    for rate in range(50, 601, 10)
                ],
            ),
            # Continental US record high: 3 Gaussian peaks at ~114°F, ~122°F, ~130°F
            # Amplitudes scaled to b=90k so peaks are clearly visible; heights are
            # deliberately different (small ~5k, tall ~35k, medium ~20k) with negative valleys
            (
                "continental US during summer",
                [
                    (
                        f"{temp}°F",
                        round(
                            20000 * math_exp(-0.5 * ((temp - 114) / 2.0) ** 2)
                            + 50000 * math_exp(-0.5 * ((temp - 122) / 2.0) ** 2)
                            + 35000 * math_exp(-0.5 * ((temp - 130) / 2.0) ** 2)
                            - 15000
                        ),
                    )
                    for temp in range(110, 136)
                ],
            ),
        ]

        def _find_security(db_market: models.Market, outcome_substr: str):
            for s in db_market.securities:
                if outcome_substr in s.outcome:
                    return s
            return None

        for question_substr, outcome_specs in trader_positions:
            db_market = next(
                (m for m in seeded_db_markets if question_substr in m.question), None
            )
            if db_market is None:
                continue

            # Start from a clean LMSR state — no prior trades exist.
            current_qtys = {s.id: 0.0 for s in db_market.securities}
            b = db_market.liquidity_parameter

            trader_legs: list[tuple[models.Security, int]] = []
            for outcome_substr, qty in outcome_specs:
                sec = _find_security(db_market, outcome_substr)
                if sec is None:
                    continue
                trader_legs.append((sec, qty))

            if not trader_legs:
                continue

            # Market/securities are backdated by 6 hours so this lands around now.
            executed_at = datetime.now(timezone.utc)
            trader_order = models.Order(
                user_id=trader_user.id,
                market_id=db_market.id,
                type=models.OrderType.MARKET,
                legs=[{"security_id": s.id, "quantity": q} for s, q in trader_legs],
                filled=True,
                created_at=executed_at,
            )
            session.add(trader_order)
            session.flush()

            # Simulate seeded trades
            order_total = 0
            for sec, qty in trader_legs:
                price = _lmsr_price_cents(current_qtys, {sec.id: float(qty)}, b)
                session.add(
                    models.Trade(
                        order_id=trader_order.id,
                        user_id=trader_user.id,
                        security_id=sec.id,
                        quantity=qty,
                        price_cents=price,
                        created_at=executed_at,
                    )
                )
                current_qtys[sec.id] += float(qty)
                order_total += price

            history_service.record_market_probability_snapshot(
                market_id=db_market.id,
                order_id=trader_order.id,
                quantities_map=current_qtys,
                liquidity_parameter=b,
                captured_at=executed_at,
            )

            trader_profile.wallet -= order_total
            mm_profile.wallet += order_total

        session.commit()
        print(
            f"Seeded {len(markets)} markets.\n"
            f"  Market-maker funding collateral: ${total_initial_funding / 100:,.2f}\n"
            f"  Market-maker wallet after seeding: ${mm_profile.wallet / 100:,.2f}\n"
            f"  Trader wallet after seeding:     ${trader_profile.wallet / 100:,.2f}"
        )
    finally:
        session.close()


def main() -> None:
    init_db()
    seed_markets()


if __name__ == "__main__":
    main()
