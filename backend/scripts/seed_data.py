#!/usr/bin/env python3
"""
Seed the SQLite database with sample markets and securities.
"""

from __future__ import annotations

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
                "settlement_dates": [
                    {
                        "label": "Midpoint Review",
                        "date": datetime.now(timezone.utc) + timedelta(days=365),
                    },
                    {
                        "label": "Final Settlement",
                        "date": datetime.now(timezone.utc) + timedelta(days=730),
                    },
                ],
                "securities": [
                    "2026 Q1",
                    "2026 Q2",
                    "2026 Q3",
                    "2026 Q4",
                    "2027 Q1",
                    "2027 Q2",
                    "2027 Q3",
                    "2027 Q4",
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
                "settlement_dates": [
                    {
                        "label": "Q2 2025",
                        "date": datetime.now(timezone.utc) + timedelta(days=180),
                    },
                    {
                        "label": "Q4 2025",
                        "date": datetime.now(timezone.utc) + timedelta(days=365),
                    },
                ],
                "securities": [
                    "2026 Q1",
                    "2026 Q2",
                    "2026 Q3",
                    "2026 Q4",
                    "2027 Q1",
                    "2027 Q2",
                    "2027 Q3",
                    "2027 Q4",
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
                "settlement_dates": [
                    {
                        "label": "2026",
                        "date": datetime.now(timezone.utc) + timedelta(days=180),
                    },
                    {
                        "label": "2030",
                        "date": datetime.now(timezone.utc) + timedelta(days=365),
                    },
                ],
                "securities": [
                    "2026",
                    "2027",
                    "2028",
                    "2029",
                    "2030",
                    "2031",
                    "2032",
                    "2033",
                ],
            },
        ]

        for market in markets:
            m = models.Market(
                question=market["question"],
                category=market["category"],
                description=market["description"],
                resolution_date=market["resolution_date"],
                status=market["status"],
                tags=market["tags"],
                liquidity_parameter=market["liquidity_parameter"],
                settlement_dates=[
                    {"label": sd["label"], "date": sd["date"].isoformat()}
                    for sd in market["settlement_dates"]
                ],
            )
            session.add(m)
            session.flush()
            for outcome in market["securities"]:
                session.add(
                    models.Security(
                        market_id=m.id,
                        outcome=outcome,
                        created_at=datetime.now(timezone.utc),
                    )
                )
        session.commit()
        print(f"Seeded {len(markets)} markets.")
    finally:
        session.close()


def main() -> None:
    init_db()
    seed_markets()


if __name__ == "__main__":
    main()
