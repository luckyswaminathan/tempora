#!/usr/bin/env python3
"""
Seed the SQLite database with sample markets and securities.
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core import models  # noqa: E402
from core.database import SessionLocal, init_db  # noqa: E402


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
                "interval_granularity": "quarter",
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
                "interval_granularity": "quarter",
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
                "interval_granularity": "year",
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
                "interval_granularity": "month",
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
                "interval_granularity": "day",
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
        ]

        # Get or create a seed user for initial trades
        seed_user = (
            session.query(models.User)
            .filter(models.User.email == "seed@tempora.com")
            .first()
        )
        if not seed_user:
            from core.security import hash_password

            seed_user = models.User(
                email="seed@tempora.com",
                password_hash=hash_password("seed123"),
                created_at=datetime.now(timezone.utc),
            )
            session.add(seed_user)
            session.flush()
            # Create profile for seed user
            session.add(
                models.Profile(
                    id=seed_user.id,
                    display_name="Seed User",
                    joined_at=datetime.now(timezone.utc),
                )
            )
            session.flush()

        for market in markets:
            m = models.Market(
                question=market["question"],
                category=market["category"],
                description=market["description"],
                resolution_date=market["resolution_date"],
                status=market["status"],
                tags=market["tags"],
                liquidity_parameter=market["liquidity_parameter"],
                interval_granularity=market.get("interval_granularity"),
            )
            session.add(m)
            session.flush()

            securities = []
            for outcome in market["securities"]:
                sec = models.Security(
                    market_id=m.id,
                    outcome=outcome,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(sec)
                securities.append(sec)
            session.flush()

            # Add random initial trades to create varied probabilities
            # Use different patterns for different markets
            random.seed(m.id)  # Consistent randomness per market

            for i, sec in enumerate(securities):
                # Generate quantities that vary but sum to reasonable totals
                # Earlier outcomes get slightly higher quantities for variety
                base_qty = random.randint(10, 50)

                # Add some variation based on position
                if "Later" in sec.outcome or "never" in sec.outcome:
                    qty = random.randint(5, 20)  # Lower for "later/never"
                elif i < len(securities) // 3:
                    qty = base_qty + random.randint(10, 30)  # Higher for early outcomes
                elif i < 2 * len(securities) // 3:
                    qty = base_qty  # Medium for middle
                else:
                    qty = base_qty - random.randint(5, 15)  # Lower for late outcomes

                # Create a trade with random price
                price = random.randint(30, 70)  # Price in cents
                trade = models.Trade(
                    user_id=seed_user.id,
                    market_id=m.id,
                    security_id=sec.id,
                    quantity=qty,
                    price_cents=price,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(trade)

        session.commit()
        print(f"Seeded {len(markets)} markets with varied probabilities.")
    finally:
        session.close()


def main() -> None:
    init_db()
    seed_markets()


if __name__ == "__main__":
    main()
