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

## Email Notification Delivery

Email sending is optional and disabled by default. Users can toggle email
notifications in profile settings, and when enabled they receive an email for
each new in-app notification.

Set these environment variables to enable delivery:

- `EMAIL_NOTIFICATIONS_ENABLED=true`
- `FRONTEND_BASE_URL=http://localhost:3000`
- `SMTP_HOST=smtp.your-provider.com`
- `SMTP_PORT=587`
- `SMTP_USERNAME=...`
- `SMTP_PASSWORD=...`
- `SMTP_USE_TLS=true`
- `SMTP_USE_SSL=false`
- `SMTP_FROM_EMAIL=no-reply@your-domain.com`
- `SMTP_FROM_NAME=Tempora`

## Testing

```
pytest -vv
```

## Database helpers

- Create tables: `python scripts/setup_database.py`
- Seed sample data: `python scripts/seed_data.py`
- Override seeded admin password: `SEED_ADMIN_PASSWORD=your-password python scripts/seed_data.py`
- Inspect counts: `python scripts/check_tables.py`
