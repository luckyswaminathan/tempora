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

# Email constants for test fixtures to avoid mismatches
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", "test@example.com")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "password123")
MARKET_MAKER_EMAIL = "market_maker@test.com"
ADMIN_EMAIL = "admin@test.com"
REGULAR_USER_EMAIL = "regular@test.com"
TRADER_EMAIL = "trader@test.com"


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
    app.dependency_overrides[deps.get_current_market_maker] = lambda: test_user
    return TestClient(app)


@pytest.fixture()
def test_market(request, db_session, test_user) -> models.Market:
    """Create a test market by seeding the database directly."""
    from datetime import datetime, timezone
    from uuid import uuid4

    outcomes = int(request.param)

    market = models.Market(
        id=str(uuid4()),
        question="Test Market",
        category="general",
        description="",
        resolution_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=1000,
        ui_type="bars-ordered",
        creator_id=test_user.id,
        funding_collateral_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(market)
    db_session.flush()

    # Create securities
    for i in range(outcomes):
        security = models.Security(
            id=str(uuid4()),
            market_id=market.id,
            outcome=str(i),
            value=float(i),
            is_catch_all=False,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(security)

    db_session.commit()
    db_session.refresh(market)

    return market


@pytest.fixture()
def trader_user(db_session) -> UserBase:
    """Create a separate trader user for trade tests (not the market maker)."""
    from services.auth import AuthService
    from schemas.user import RegisterRequest

    service = AuthService(db_session)
    email = TRADER_EMAIL

    existing = (
        db_session.query(models.User).filter(models.User.email == email).one_or_none()
    )
    if not existing:
        service.register(
            RegisterRequest(
                email=email,
                password="testpass123",
                display_name="Trader User",
            )
        )
        existing = (
            db_session.query(models.User).filter(models.User.email == email).one()
        )

    # Give trader funds for trading
    profile = (
        db_session.query(models.Profile)
        .filter(models.Profile.id == existing.id)
        .first()
    )
    if profile and profile.wallet < 100_000:
        profile.wallet = 100_000  # $1,000
        db_session.commit()

    return UserBase.model_validate(
        {
            "id": existing.id,
            "email": existing.email,
            "role": existing.role,
            "createdAt": existing.created_at,
        }
    )


@pytest.fixture()
def trader_client(trader_user) -> TestClient:
    """Client authenticated as a trader (for trade tests)."""
    app = create_app()
    app.dependency_overrides[deps.get_current_user] = lambda: trader_user
    return TestClient(app)


@pytest.fixture()
def trade_market(request, db_session, market_maker_user) -> models.Market:
    """Create a market with a market maker for trade tests.

    This ensures the trader and market maker are different users.
    Can be parameterized with number of outcomes.
    """
    from datetime import datetime, timezone
    from uuid import uuid4

    # Support parameterization for number of outcomes
    outcomes = int(request.param) if hasattr(request, "param") else 4

    market = models.Market(
        id=str(uuid4()),
        question="Trade Test Market",
        category="general",
        description="",
        resolution_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=1000,
        ui_type="bars-ordered",
        creator_id=market_maker_user.id,  # Market maker creates it
        funding_collateral_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(market)
    db_session.flush()

    # Create securities
    for i in range(outcomes):
        security = models.Security(
            id=str(uuid4()),
            market_id=market.id,
            outcome=str(i),
            value=float(i),
            is_catch_all=False,
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(security)

    db_session.commit()
    db_session.refresh(market)

    return market


@pytest.fixture()
def market_maker_user(db_session) -> UserBase:
    """Create a market maker user with funds for testing."""
    from services.auth import AuthService
    from schemas.user import RegisterRequest

    service = AuthService(db_session)
    email = MARKET_MAKER_EMAIL

    existing = (
        db_session.query(models.User).filter(models.User.email == email).one_or_none()
    )
    if not existing:
        service.register(
            RegisterRequest(
                email=email,
                password="testpass123",
                display_name="Market Maker",
            )
        )
        existing = (
            db_session.query(models.User).filter(models.User.email == email).one()
        )
        existing.role = models.UserRole.MARKET_MAKER
        db_session.commit()

    # Ensure market maker has sufficient funds
    profile = (
        db_session.query(models.Profile)
        .filter(models.Profile.id == existing.id)
        .first()
    )
    if profile and profile.wallet < 1_000_000:
        profile.wallet = 1_000_000  # $10,000
        db_session.commit()

    return UserBase.model_validate(
        {
            "id": existing.id,
            "email": existing.email,
            "role": existing.role,
            "createdAt": existing.created_at,
        }
    )


@pytest.fixture()
def admin_user(db_session) -> UserBase:
    """Create an admin user for testing."""
    from services.auth import AuthService
    from schemas.user import RegisterRequest

    service = AuthService(db_session)
    email = ADMIN_EMAIL

    existing = (
        db_session.query(models.User).filter(models.User.email == email).one_or_none()
    )
    if not existing:
        service.register(
            RegisterRequest(
                email=email,
                password="testpass123",
                display_name="Admin User",
            )
        )
        existing = (
            db_session.query(models.User).filter(models.User.email == email).one()
        )
        existing.role = models.UserRole.ADMIN
        db_session.commit()

    return UserBase.model_validate(
        {
            "id": existing.id,
            "email": existing.email,
            "role": existing.role,
            "createdAt": existing.created_at,
        }
    )


@pytest.fixture()
def regular_user(db_session) -> UserBase:
    """Create a regular user with funds for testing."""
    from services.auth import AuthService
    from schemas.user import RegisterRequest

    service = AuthService(db_session)
    email = REGULAR_USER_EMAIL

    existing = (
        db_session.query(models.User).filter(models.User.email == email).one_or_none()
    )
    if not existing:
        service.register(
            RegisterRequest(
                email=email,
                password="testpass123",
                display_name="Regular User",
            )
        )
        existing = (
            db_session.query(models.User).filter(models.User.email == email).one()
        )

    # Give user funds for trading
    profile = (
        db_session.query(models.Profile)
        .filter(models.Profile.id == existing.id)
        .first()
    )
    if profile and profile.wallet < 100_000:
        profile.wallet = 100_000  # $1,000
        db_session.commit()

    return UserBase.model_validate(
        {
            "id": existing.id,
            "email": existing.email,
            "role": existing.role,
            "createdAt": existing.created_at,
        }
    )


@pytest.fixture()
def market_maker_client(market_maker_user):
    """Client authenticated as market maker."""
    from main import create_app
    from api import deps
    from fastapi.testclient import TestClient

    app = create_app()
    app.dependency_overrides[deps.get_current_user] = lambda: market_maker_user
    app.dependency_overrides[deps.get_current_market_maker] = lambda: market_maker_user
    return TestClient(app)


@pytest.fixture()
def admin_client(admin_user):
    """Client authenticated as admin."""
    from main import create_app
    from api import deps
    from fastapi.testclient import TestClient

    app = create_app()
    app.dependency_overrides[deps.get_current_user] = lambda: admin_user
    app.dependency_overrides[deps.get_current_admin] = lambda: admin_user
    return TestClient(app)


@pytest.fixture()
def user_client(regular_user):
    """Client authenticated as regular user."""
    from main import create_app
    from api import deps
    from fastapi.testclient import TestClient

    app = create_app()
    app.dependency_overrides[deps.get_current_user] = lambda: regular_user
    return TestClient(app)


def create_and_publish_market(
    market_maker_client, admin_client, outcomes=None, liquidity=50
):
    """Helper to create and publish a market through the proposal flow.

    Args:
        market_maker_client: Authenticated market maker test client
        admin_client: Authenticated admin test client
        outcomes: List of outcome strings or dicts (defaults to ["Yes", "No"])
        liquidity: Liquidity parameter (defaults to 50)

    Returns:
        Market: The published market
    """
    from schemas.market import Market

    if outcomes is None:
        outcomes = ["Yes", "No"]

    # Convert string outcomes to proper format if needed
    formatted_outcomes = []
    for outcome in outcomes:
        if isinstance(outcome, str):
            formatted_outcomes.append({"outcome": outcome})
        else:
            formatted_outcomes.append(outcome)

    # Create proposal
    proposal_payload = {
        "question": "Test Market",
        "outcomes": formatted_outcomes,
        "category": "test",
        "resolutionDate": "2030-12-31T23:59:59",
        "liquidityParameter": liquidity,
        "uiType": "binary" if len(outcomes) == 2 else "interval",
    }
    resp = market_maker_client.post("/proposals", json=proposal_payload)
    assert resp.status_code == 201
    proposal_id = resp.json()["id"]

    # Admin approves
    resp = admin_client.post(
        f"/proposals/{proposal_id}/review", json={"approved": True}
    )
    assert resp.status_code == 200

    # Market maker publishes
    resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
    assert resp.status_code == 200

    # Get the created market
    market_id = resp.json()["createdMarketId"]
    resp = market_maker_client.get(f"/markets/{market_id}")
    assert resp.status_code == 200
    return Market.model_validate(resp.json())


def create_position(client, market_id, security_id, quantity):
    """Helper to create a position for settlement tests.

    This is a setup utility for settlement tests - it executes trades but does NOT
    test the trading mechanism. Trading functionality is tested in test_trades.py.

    Settlement tests use this to establish positions before testing settlement logic.

    Args:
        client: Authenticated test client
        market_id: Market ID
        security_id: Security ID to trade
        quantity: Quantity to trade (positive for buy, negative for sell)

    Returns:
        dict: Trade response data including priceCents
    """
    payload = {
        "marketId": market_id,
        "legs": [{"securityId": security_id, "quantity": quantity}],
    }
    resp = client.post("/trades", json=payload)
    assert resp.status_code == 201, f"Position setup failed: {resp.json()}"
    return resp.json()
