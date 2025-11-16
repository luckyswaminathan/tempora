#!/usr/bin/env python3
"""
Seed script to populate the database with sample markets and data.
Run this after setting up your Supabase database and environment variables.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import settings
from core.supabase import require_supabase_client


def seed_markets() -> None:
    """Create sample markets."""
    supabase = require_supabase_client()

    markets = [
        {
            "market": {
                "question": "When will the US enter a recession?",
                "category": "Economics",
                "description": "A recession is defined as two consecutive quarters of negative GDP growth.",
                "resolution_date": (
                    datetime.now(timezone.utc) + timedelta(days=730)
                ).isoformat(),
                "status": "open",
                "tags": ["macroeconomics", "economy", "us"],
                "liquidity_parameter": 1000.0,
                "settlement_dates": [
                    {
                        "label": "Midpoint Review",
                        "date": (
                            datetime.now(timezone.utc) + timedelta(days=365)
                        ).isoformat(),
                    },
                    {
                        "label": "Final Settlement",
                        "date": (
                            datetime.now(timezone.utc) + timedelta(days=730)
                        ).isoformat(),
                    },
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
                "question": "When will Bitcoin reach $150,000?",
                "category": "Technology",
                "description": "Bitcoin price must reach or exceed $150,000 USD before January 1, 2026.",
                "resolution_date": (
                    datetime.now(timezone.utc) + timedelta(days=365)
                ).isoformat(),
                "status": "open",
                "tags": ["cryptocurrency", "bitcoin", "crypto"],
                "liquidity_parameter": 800.0,
                "settlement_dates": [
                    {
                        "label": "Q2 2025",
                        "date": (
                            datetime.now(timezone.utc) + timedelta(days=180)
                        ).isoformat(),
                    },
                    {
                        "label": "Q4 2025",
                        "date": (
                            datetime.now(timezone.utc) + timedelta(days=365)
                        ).isoformat(),
                    },
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
    """Main entry point."""
    print("Starting database seeding...")
    print(f"Supabase URL: {settings.supabase_url}")

    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("ERROR: Supabase credentials not configured!")
        print(
            "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
        )
        sys.exit(1)

    try:
        seed_markets()
        print("\n✓ Seeding completed successfully!")
    except Exception as e:
        print(f"\n✗ Seeding failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
