#!/usr/bin/env python3
"""
Seed script to populate the database with sample markets and data.
Run this after setting up your Supabase database and environment variables.
"""

import os
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
            "question": "Will the US enter a recession before 2027?",
            "category": "Economics",
            "description": "A recession is defined as two consecutive quarters of negative GDP growth.",
            "resolution_date": (datetime.now(timezone.utc) + timedelta(days=730)).isoformat(),
            "status": "open",
            "tags": ["macroeconomics", "economy", "us"],
            "baseline_probability": 0.40,
            "initial_liquidity": 1000.0,
            "settlement_dates": [
                {"label": "Midpoint Review", "date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()},
                {"label": "Final Settlement", "date": (datetime.now(timezone.utc) + timedelta(days=730)).isoformat()},
            ],
        },
        {
            "question": "Will Bitcoin reach $150,000 before 2026?",
            "category": "Technology",
            "description": "Bitcoin price must reach or exceed $150,000 USD before January 1, 2026.",
            "resolution_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "status": "open",
            "tags": ["cryptocurrency", "bitcoin", "crypto"],
            "baseline_probability": 0.35,
            "initial_liquidity": 800.0,
            "settlement_dates": [
                {"label": "Q2 2025", "date": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat()},
                {"label": "Q4 2025", "date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()},
            ],
        },
        {
            "question": "Will AI replace 25% of software engineering jobs by 2028?",
            "category": "Technology",
            "description": "At least 25% of current software engineering positions must be replaced by AI systems.",
            "resolution_date": (datetime.now(timezone.utc) + timedelta(days=1095)).isoformat(),
            "status": "open",
            "tags": ["ai", "automation", "jobs", "technology"],
            "baseline_probability": 0.28,
            "initial_liquidity": 750.0,
            "settlement_dates": [
                {"label": "End 2026", "date": (datetime.now(timezone.utc) + timedelta(days=730)).isoformat()},
                {"label": "End 2027", "date": (datetime.now(timezone.utc) + timedelta(days=1095)).isoformat()},
            ],
        },
        {
            "question": "Will global temperatures rise by 1.5°C before 2030?",
            "category": "Climate",
            "description": "Global average temperature must rise by 1.5°C above pre-industrial levels.",
            "resolution_date": (datetime.now(timezone.utc) + timedelta(days=2190)).isoformat(),
            "status": "open",
            "tags": ["climate", "environment", "global warming"],
            "baseline_probability": 0.68,
            "initial_liquidity": 1200.0,
            "settlement_dates": [
                {"label": "2027", "date": (datetime.now(timezone.utc) + timedelta(days=1095)).isoformat()},
                {"label": "2028", "date": (datetime.now(timezone.utc) + timedelta(days=1460)).isoformat()},
                {"label": "2029", "date": (datetime.now(timezone.utc) + timedelta(days=1825)).isoformat()},
            ],
        },
        {
            "question": "Will SpaceX land humans on Mars before 2030?",
            "category": "Technology",
            "description": "SpaceX must successfully land humans on Mars and return them safely to Earth.",
            "resolution_date": (datetime.now(timezone.utc) + timedelta(days=2190)).isoformat(),
            "status": "open",
            "tags": ["space", "mars", "spacex", "exploration"],
            "baseline_probability": 0.15,
            "initial_liquidity": 1500.0,
            "settlement_dates": [
                {"label": "2027", "date": (datetime.now(timezone.utc) + timedelta(days=1095)).isoformat()},
                {"label": "2028", "date": (datetime.now(timezone.utc) + timedelta(days=1460)).isoformat()},
                {"label": "2029", "date": (datetime.now(timezone.utc) + timedelta(days=1825)).isoformat()},
            ],
        },
        {
            "question": "Will remote work become the majority by 2026?",
            "category": "Economics",
            "description": "Over 50% of workers must be working remotely on a regular basis.",
            "resolution_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "status": "open",
            "tags": ["work", "remote", "employment", "future of work"],
            "baseline_probability": 0.52,
            "initial_liquidity": 600.0,
            "settlement_dates": [
                {"label": "Mid 2025", "date": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat()},
                {"label": "End 2025", "date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()},
            ],
        },
    ]

    print("Creating markets...")
    for market in markets:
        try:
            result = supabase.table("markets").insert(market).execute()
            if result.data:
                print(f"✓ Created market: {market['question']}")
            else:
                print(f"✗ Failed to create market: {market['question']}")
        except Exception as e:
            print(f"✗ Error creating market '{market['question']}': {e}")

    print(f"\nCreated {len(markets)} markets")


def main() -> None:
    """Main entry point."""
    print("Starting database seeding...")
    print(f"Supabase URL: {settings.supabase_url}")
    
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("ERROR: Supabase credentials not configured!")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.")
        sys.exit(1)

    try:
        seed_markets()
        print("\n✓ Seeding completed successfully!")
    except Exception as e:
        print(f"\n✗ Seeding failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

