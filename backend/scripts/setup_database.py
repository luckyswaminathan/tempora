#!/usr/bin/env python3
"""
Create the SQLite tables for Tempora.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import init_db  # noqa: E402


def main() -> None:
    init_db()
    print("Database initialised.")


if __name__ == "__main__":
    main()
