#!/usr/bin/env python3
"""
Quick utility to print table counts for the SQLite database.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select  # noqa: E402

from core import models  # noqa: E402
from core.database import SessionLocal, init_db  # noqa: E402


def main() -> None:
    init_db()
    session = SessionLocal()
    try:
        tables = {
            "users": select(models.User),
            "profiles": select(models.Profile),
            "markets": select(models.Market),
            "securities": select(models.Security),
            "trades": select(models.Trade),
        }
        for name, stmt in tables.items():
            count = session.execute(stmt).all()
            print(f"{name}: {len(count)} rows")
    finally:
        session.close()


if __name__ == "__main__":
    main()
