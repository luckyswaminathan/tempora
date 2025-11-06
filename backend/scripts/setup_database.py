#!/usr/bin/env python3
"""
Setup database tables in Supabase.
This script creates all necessary tables for the Tempora prediction markets app.
"""

import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import settings
from core.supabase import require_supabase_client


def setup_tables() -> None:
    """Create all necessary database tables."""
    supabase = require_supabase_client()

    sql_file = Path(__file__).parent / "create_tables.sql"
    
    if not sql_file.exists():
        print(f"Error: SQL file not found at {sql_file}")
        sys.exit(1)

    print("Reading SQL migration file...")
    with open(sql_file, "r") as f:
        sql = f.read()

    # Split SQL into individual statements (simple approach)
    statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]

    print(f"Executing {len(statements)} SQL statements...")

    for i, statement in enumerate(statements, 1):
        if not statement:
            continue
        
        try:
            # Execute using Supabase's RPC or direct SQL
            # Note: Supabase Python client doesn't support direct SQL execution
            # So we'll use the REST API with rpc or postgrest
            result = supabase.rpc("exec_sql", {"sql": statement}).execute()
            print(f"✓ [{i}/{len(statements)}] Executed statement")
        except Exception as e:
            # Try alternative approach - execute via postgrest
            print(f"⚠ [{i}/{len(statements)}] Could not execute statement directly: {e}")
            print("   You may need to run the SQL manually in Supabase Dashboard")

    print("\n✓ Database setup complete!")
    print("\nNOTE: If some statements failed, please run the SQL file manually:")
    print("   1. Go to Supabase Dashboard -> SQL Editor")
    print(f"   2. Copy contents of: {sql_file}")
    print("   3. Paste and execute in SQL Editor")


def main() -> None:
    """Main entry point."""
    print("Setting up Tempora database tables...")
    print(f"Supabase URL: {settings.supabase_url}")
    
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("ERROR: Supabase credentials not configured!")
        print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.")
        sys.exit(1)

    try:
        print("\n⚠️  IMPORTANT: The Supabase Python client cannot execute raw SQL.")
        print("   Please run the SQL manually in your Supabase Dashboard:\n")
        print("   1. Open: https://supabase.com/dashboard/project/oyzbtlhgeqqhlmalxdvm/sql")
        print(f"   2. Copy the SQL from: {Path(__file__).parent / 'create_tables.sql'}")
        print("   3. Paste it into the SQL Editor and click 'Run'")
        print("\n   Alternatively, you can use psql or the Supabase CLI.\n")
        
        # Still try to verify connection
        supabase = require_supabase_client()
        print("✓ Successfully connected to Supabase")
        print("\nPlease run the SQL migration manually as described above.")
        
    except Exception as e:
        print(f"\n✗ Setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

