Backend for Tempora. Uses FastAPI + SQLite (via SQLAlchemy) and comes with a Docker Compose setup for a durable dev database.

## Installation

Activate your python virtual environment of choice (`python=3.12`), and in `backend/`:

```
pip install -r requirements.txt
```

Copy `.env` and adjust if needed (defaults point to `./.data/sqlite/tempora.db`):

```
cp .env .env.local  # optional; or edit .env directly
```

## Running

```
uvicorn main:app --reload
```

Or run via Docker (back-end + SQLite volume shared between runs):

```
docker compose up --build backend
```

## Testing

```
pytest -vv
```

## Database helpers

- Create tables: `python scripts/setup_database.py`
- Seed sample data: `python scripts/seed_data.py`
- Inspect counts: `python scripts/check_tables.py`
