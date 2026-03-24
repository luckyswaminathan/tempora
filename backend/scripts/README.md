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

  Admin seed password is read from `SEED_ADMIN_PASSWORD` in `backend/.env`.

- Check row counts:
  ```bash
  python scripts/check_tables.py
  ```
