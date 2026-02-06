"""
Tests for market proposal creation, review, and publishing.

Proposal flow:
1. Market maker creates a proposal
2. Admin reviews (approves or rejects)
3. If approved, market maker publishes it to create a live market

Collateral rules for publishing:
- Market maker must have wallet >= (existing_collateral_locked + funding_collateral_cents)
- funding_collateral_cents = b * ln(N) = maximum LMSR loss
- Collateral is locked but not deducted upfront
- Collateral is paid out at settlement
"""

import pytest
from core.models import UserRole
from schemas.user import UserBase


@pytest.fixture()
def market_maker_user(db_session) -> UserBase:
    """Create a market maker user for testing."""
    from services.auth import AuthService
    from schemas.user import RegisterRequest
    from core import models

    service = AuthService(db_session)
    service.register(
        RegisterRequest(
            email="market_maker@example.com",
            password="password123",
            display_name="Market Maker",
        )
    )

    # Upgrade user to market maker
    user = (
        db_session.query(models.User)
        .filter(models.User.email == "market_maker@example.com")
        .first()
    )
    user.role = UserRole.MARKET_MAKER
    db_session.commit()

    return UserBase.model_validate(
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "createdAt": user.created_at,
        }
    )


@pytest.fixture()
def admin_user(db_session) -> UserBase:
    """Create an admin user for testing."""
    from services.auth import AuthService
    from schemas.user import RegisterRequest
    from core import models

    service = AuthService(db_session)
    service.register(
        RegisterRequest(
            email="admin@example.com",
            password="password123",
            display_name="Admin User",
        )
    )

    # Upgrade user to admin
    user = (
        db_session.query(models.User)
        .filter(models.User.email == "admin@example.com")
        .first()
    )
    user.role = UserRole.ADMIN
    db_session.commit()

    return UserBase.model_validate(
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "createdAt": user.created_at,
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


class TestProposalCreation:
    """Tests for creating market proposals."""

    def test_market_maker_can_create_proposal(self, market_maker_client):
        """Market makers can create proposals."""
        payload = {
            "question": "Will it rain tomorrow?",
            "outcomes": ["Yes", "No"],
            "category": "weather",
            "resolutionDate": "2030-12-31T23:59:59",
            "description": "Test proposal",
            "liquidityParameter": 100,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["question"] == payload["question"]
        assert data["status"] == "pending"
        assert len(data["outcomes"]) == 2

    def test_proposal_requires_minimum_outcomes(self, market_maker_client):
        """Proposals must have at least 2 outcomes."""
        payload = {
            "question": "Invalid proposal",
            "outcomes": ["Only one"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 100,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 400
        assert "at least 2 outcomes" in resp.json()["detail"].lower()

    def test_get_my_proposals(self, market_maker_client):
        """Market makers can retrieve their own proposals."""
        # Create a proposal first
        payload = {
            "question": "Test Market 1",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 100,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 201

        # Get my proposals
        resp = market_maker_client.get("/proposals/mine")
        assert resp.status_code == 200

        data = resp.json()
        assert data["count"] >= 1
        assert any(p["question"] == "Test Market 1" for p in data["proposals"])


class TestProposalReview:
    """Tests for admin reviewing proposals."""

    def test_admin_can_approve_proposal(self, market_maker_client, admin_client):
        """Admins can approve pending proposals."""
        # Market maker creates proposal
        payload = {
            "question": "Will it snow?",
            "outcomes": ["Yes", "No"],
            "category": "weather",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 100,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 201
        proposal_id = resp.json()["id"]

        # Admin approves
        review_payload = {
            "approved": True,
            "note": "Looks good!",
        }
        resp = admin_client.post(
            f"/proposals/{proposal_id}/review", json=review_payload
        )
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "approved"
        assert data["reviewNote"] == "Looks good!"

    def test_admin_can_reject_proposal(self, market_maker_client, admin_client):
        """Admins can reject pending proposals."""
        # Market maker creates proposal
        payload = {
            "question": "Invalid market",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 100,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 201
        proposal_id = resp.json()["id"]

        # Admin rejects
        review_payload = {
            "approved": False,
            "note": "Not appropriate",
        }
        resp = admin_client.post(
            f"/proposals/{proposal_id}/review", json=review_payload
        )
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "rejected"
        assert data["reviewNote"] == "Not appropriate"

    def test_cannot_review_already_reviewed_proposal(
        self, market_maker_client, admin_client
    ):
        """Cannot review a proposal that has already been reviewed."""
        # Create and approve proposal
        payload = {
            "question": "Test",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 100,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        proposal_id = resp.json()["id"]

        review_payload = {"approved": True}
        resp = admin_client.post(
            f"/proposals/{proposal_id}/review", json=review_payload
        )
        assert resp.status_code == 200

        # Try to review again
        resp = admin_client.post(
            f"/proposals/{proposal_id}/review", json=review_payload
        )
        assert resp.status_code == 400
        assert "already been reviewed" in resp.json()["detail"].lower()

    def test_admin_can_see_pending_proposals(self, market_maker_client, admin_client):
        """Admins can see all pending proposals."""
        # Create multiple proposals
        for i in range(3):
            payload = {
                "question": f"Market {i}",
                "outcomes": ["Yes", "No"],
                "category": "general",
                "resolutionDate": "2030-12-31T23:59:59",
                "liquidityParameter": 100,
                "uiType": "binary",
            }
            resp = market_maker_client.post("/proposals", json=payload)
            assert resp.status_code == 201

        # Admin gets pending proposals
        resp = admin_client.get("/proposals/pending")
        assert resp.status_code == 200

        data = resp.json()
        assert data["count"] >= 3


class TestProposalPublishing:
    """Tests for publishing approved proposals."""

    def test_can_publish_approved_proposal(self, market_maker_client, admin_client):
        """Market makers can publish their approved proposals."""
        # Create proposal
        payload = {
            "question": "Will it be sunny?",
            "outcomes": ["Yes", "No"],
            "category": "weather",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 50,  # Small liquidity for testing
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 201
        proposal_id = resp.json()["id"]

        # Admin approves
        review_payload = {"approved": True}
        resp = admin_client.post(
            f"/proposals/{proposal_id}/review", json=review_payload
        )
        assert resp.status_code == 200

        # Market maker publishes
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 200

        data = resp.json()
        assert data["status"] == "live"
        assert "createdMarketId" in data

    def test_cannot_publish_pending_proposal(self, market_maker_client):
        """Cannot publish a proposal that hasn't been approved."""
        # Create proposal (not approved)
        payload = {
            "question": "Test",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 50,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        proposal_id = resp.json()["id"]

        # Try to publish without approval
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 400
        assert "approved" in resp.json()["detail"].lower()

    def test_cannot_publish_rejected_proposal(self, market_maker_client, admin_client):
        """Cannot publish a rejected proposal."""
        # Create and reject proposal
        payload = {
            "question": "Test",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 50,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        proposal_id = resp.json()["id"]

        review_payload = {"approved": False}
        admin_client.post(f"/proposals/{proposal_id}/review", json=review_payload)

        # Try to publish rejected proposal
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 400


class TestProposalCollateral:
    """Tests for collateral requirements when publishing proposals."""

    def test_publishing_requires_sufficient_collateral(
        self, market_maker_client, admin_client, db_session
    ):
        """Publishing requires wallet >= funding collateral."""
        from core import models

        # Get market maker's profile and drain most funds
        user = (
            db_session.query(models.User)
            .filter(models.User.email == "market_maker@example.com")
            .first()
        )
        profile = (
            db_session.query(models.Profile)
            .filter(models.Profile.id == user.id)
            .first()
        )

        # Leave only $5 (500 cents)
        profile.wallet = 500
        db_session.commit()

        # Create proposal with high liquidity (requires b * ln(2) ≈ $69 for 2 outcomes)
        payload = {
            "question": "Test",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 100,  # Requires ~69.31 cents collateral
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        proposal_id = resp.json()["id"]

        # Admin approves
        review_payload = {"approved": True}
        admin_client.post(f"/proposals/{proposal_id}/review", json=review_payload)

        # Try to publish - should fail due to insufficient funds
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 400
        assert "insufficient" in resp.json()["detail"].lower()

    def test_collateral_accounts_for_existing_positions(
        self, market_maker_client, admin_client, db_session
    ):
        """Total collateral requirement includes existing short positions."""
        from core import models

        # Create and publish first market
        payload1 = {
            "question": "Market 1",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 50,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload1)
        proposal_id1 = resp.json()["id"]

        admin_client.post(f"/proposals/{proposal_id1}/review", json={"approved": True})
        resp = market_maker_client.post(f"/proposals/{proposal_id1}/publish")
        assert resp.status_code == 200

        # Get wallet balance after first market
        resp = market_maker_client.get("/users/me/profile")
        wallet_after_first = resp.json()["wallet"]

        # Now drain funds leaving just enough for one market but not two
        user = (
            db_session.query(models.User)
            .filter(models.User.email == "market_maker@example.com")
            .first()
        )
        profile = (
            db_session.query(models.Profile)
            .filter(models.Profile.id == user.id)
            .first()
        )

        # Set wallet to just enough for ~35 cents collateral (not enough for another 50 param market)
        profile.wallet = 4000  # $40 = 4000 cents
        db_session.commit()

        # Try to create second market with same liquidity parameter
        payload2 = {
            "question": "Market 2",
            "outcomes": ["Yes", "No"],
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 50,
            "uiType": "binary",
        }
        resp = market_maker_client.post("/proposals", json=payload2)
        proposal_id2 = resp.json()["id"]

        admin_client.post(f"/proposals/{proposal_id2}/review", json={"approved": True})

        # Should fail because first market's collateral + second market's collateral > wallet
        resp = market_maker_client.post(f"/proposals/{proposal_id2}/publish")
        assert resp.status_code == 400
        assert "collateral" in resp.json()["detail"].lower()

    def test_can_publish_multiple_markets_with_sufficient_funds(
        self, market_maker_client, admin_client
    ):
        """Can publish multiple markets if wallet covers all collateral."""
        # Create and publish first market
        for i in range(2):
            payload = {
                "question": f"Market {i}",
                "outcomes": ["Yes", "No"],
                "category": "general",
                "resolutionDate": "2030-12-31T23:59:59",
                "liquidityParameter": 30,  # Small liquidity
                "uiType": "binary",
            }
            resp = market_maker_client.post("/proposals", json=payload)
            proposal_id = resp.json()["id"]

            admin_client.post(
                f"/proposals/{proposal_id}/review", json={"approved": True}
            )

            resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
            assert resp.status_code == 200

    def test_collateral_calculation_scales_with_outcomes(
        self, market_maker_client, admin_client, db_session
    ):
        """Collateral requirement increases with number of outcomes (b * ln(N))."""
        from core import models
        import math

        # Get initial wallet
        resp = market_maker_client.get("/users/me/profile")
        initial_wallet = resp.json()["wallet"]

        # Create market with many outcomes (requires more collateral)
        outcomes = [f"Outcome {i}" for i in range(10)]  # 10 outcomes
        liquidity = 100
        expected_collateral = int(liquidity * math.log(len(outcomes)) * 100)

        payload = {
            "question": "Multi-outcome market",
            "outcomes": outcomes,
            "category": "general",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": liquidity,
            "uiType": "interval",
        }
        resp = market_maker_client.post("/proposals", json=payload)
        proposal_id = resp.json()["id"]

        # Set wallet to just under required collateral
        user = (
            db_session.query(models.User)
            .filter(models.User.email == "market_maker@example.com")
            .first()
        )
        profile = (
            db_session.query(models.Profile)
            .filter(models.Profile.id == user.id)
            .first()
        )
        profile.wallet = expected_collateral - 10  # Just under requirement
        db_session.commit()

        admin_client.post(f"/proposals/{proposal_id}/review", json={"approved": True})

        # Should fail
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 400

        # Now set wallet to exactly required
        profile.wallet = expected_collateral
        db_session.commit()

        # Should succeed
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 200
