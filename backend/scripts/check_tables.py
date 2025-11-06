#!/usr/bin/env python3
"""
Check if database tables exist and are accessible.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.supabase import require_supabase_client


def check_tables() -> None:
    """Check if required tables exist."""
    supabase = require_supabase_client()
    
    tables_to_check = ["profiles", "markets", "trades"]
    
    print("Checking database tables...")
    print(f"Supabase URL: {supabase.base_url}\n")
    
    for table in tables_to_check:
        try:
            # Try a simple query
            result = supabase.table(table).select("count", count="exact").limit(1).execute()
            print(f"✓ Table '{table}' exists and is accessible")
            if hasattr(result, 'count'):
                print(f"  Records: {result.count}")
        except Exception as e:
            print(f"✗ Table '{table}' error: {e}")


if __name__ == "__main__":
    try:
        check_tables()
    except Exception as e:
        print(f"Error: {e}")
        print("\nMake sure:")
        print("1. You've run the SQL migration in Supabase Dashboard")
        print("2. Your SUPABASE_SERVICE_ROLE_KEY is correct")
        print("3. Wait a few seconds after creating tables for PostgREST to refresh")
        sys.exit(1)

