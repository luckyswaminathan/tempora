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
            "securities": [
                {"outcome": "2026 Q1"},
                {"outcome": "2026 Q2"},
                {"outcome": "2026 Q3"},
                {"outcome": "2026 Q4"},
                {"outcome": "2027 Q1"},
                {"outcome": "2027 Q2"},
                {"outcome": "2027 Q3"},
                {"outcome": "2027 Q4"},
            ],
        },
        {
            "market": {
                "question": "When will the next Constitutional amendment be ratified?",
                "category": "Politics",
                "description": "",
                "resolution_date": (
                    datetime.now(timezone.utc) + timedelta(days=365)
                ).isoformat(),
                "status": "open",
                "tags": ["constitution", "congress", "law"],
                "liquidity_parameter": 100000,
                "settlement_dates": [
                    {
                        "label": "2026",
                        "date": (
                            datetime.now(timezone.utc) + timedelta(days=180)
                        ).isoformat(),
                    },
                    {
                        "label": "2030",
                        "date": (
                            datetime.now(timezone.utc) + timedelta(days=365)
                        ).isoformat(),
                    },
                ],
            },
            "securities": [
                {"outcome": "2026"},
                {"outcome": "2027"},
                {"outcome": "2028"},
                {"outcome": "2029"},
                {"outcome": "2030"},
                {"outcome": "2031"},
                {"outcome": "2032"},
                {"outcome": "2033"},
            ],
        },
    ]

    print("Creating markets...")
    for market_obj in markets:
        market, securities = market_obj["market"], market_obj["securities"]
        market_id = None
        try:
            result = supabase.table("markets").insert(market).execute()
            if result.data:
                print(f"✓ Created market: {market['question']}")
                market_id = result.data[0]["id"]
            else:
                print(f"✗ Failed to create market: {market['question']}")
        except Exception as e:
            print(f"✗ Error creating market '{market['question']}': {e}")

        for security in securities:
            security["market_id"] = market_id
            try:
                result = supabase.table("securities").insert(security).execute()
                if result.data:
                    print(f"✓ Created security: {security['outcome']}")
                else:
                    print(f"✗ Failed to create security: {security['outcome']}")
            except Exception as e:
                print(f"✗ Error creating security '{security['outcome']}': {e}")

        print()

    print(f"\nCreated {len(markets)} markets")


def main() -> None:
    init_db()
    seed_markets()


if __name__ == "__main__":
    main()
