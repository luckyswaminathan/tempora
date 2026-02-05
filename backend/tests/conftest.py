import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env.test")

from main import create_app  # noqa: E402

from api import deps  # noqa: E402
from core import models  # noqa: E402
from core.database import Base, SessionLocal, engine, init_db  # noqa: E402
from services.auth import AuthService  # noqa: E402

from schemas.user import UserBase, RegisterRequest  # noqa: E402
from schemas.market import Market


TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", "test@example.com")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "password123")


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    init_db()
    yield


@pytest.fixture(autouse=True)
def reset_db():
    """Clear all tables between tests to keep isolation."""
    with SessionLocal() as session:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
    yield


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def test_user(db_session) -> UserBase:
    service = AuthService(db_session)
    existing = (
        db_session.query(models.User)
        .filter(models.User.email == TEST_USER_EMAIL)
        .one_or_none()
    )
    if not existing:
        service.register(
            RegisterRequest(
                email=TEST_USER_EMAIL,
                password=TEST_USER_PASSWORD,
                display_name="Test User",
            )
        )
        existing = (
            db_session.query(models.User)
            .filter(models.User.email == TEST_USER_EMAIL)
            .one()
        )
    return UserBase.model_validate(
        {
            "id": existing.id,
            "email": existing.email,
            "role": existing.role,
            "createdAt": existing.created_at,
        }
    )


@pytest.fixture()
def client(test_user) -> TestClient:
    app = create_app()
    app.dependency_overrides[deps.get_current_user] = lambda: test_user
    app.dependency_overrides[deps.get_current_admin] = lambda: test_user
    return TestClient(app)


@pytest.fixture()
def test_market(request, client) -> Market:
    outcomes = int(request.param)

    payload = {
        "question": "?",
        "outcomes": [{"outcome": str(i)} for i in range(outcomes)],
        "category": "general",
        "resolutionDate": "2030-01-01T00:00:00",
        "description": "",
        "liquidityParameter": "1000",
    }

    resp = client.post("/markets", json=payload)
    assert resp.status_code == 201

    return Market.model_validate(resp.json())
