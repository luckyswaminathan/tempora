# Database utilities

The backend now uses SQLite. Helpful utilities:

- Create tables (idempotent):
  ```bash
  python scripts/setup_database.py
  ```

- Seed example markets and securities:
  ```bash
  python scripts/seed_data.py
  ```

- Check row counts:
  ```bash
  python scripts/check_tables.py
  ```
