"""
Tests for market proposal creation, review, and publishing.

Proposal flow:
1. Market maker creates a proposal
2. Admin reviews (approves or rejects)
3. If approved, market maker publishes it to create a live market

Collateral rules for publishing:
- Market maker must have wallet >= (existing_collateral_locked + initial_funding_cents)
- initial_funding_cents = b * ln(N) = maximum LMSR loss
- Collateral is locked but not deducted upfront
- Collateral is paid out at settlement
"""

import math

import sys
from pathlib import Path

# Import email constant from conftest
sys.path.insert(0, str(Path(__file__).parent))
from conftest import MARKET_MAKER_EMAIL  # noqa: E402


class TestProposalQuote:
    """Tests for the GET /proposals/quote pricing endpoint."""

    def test_quote_two_outcomes(self, market_maker_client):
        """Quote for 2 outcomes matches b * ln(2) * 100 cents."""
        liquidity = 100
        num_outcomes = 2
        expected = int(liquidity * math.log(num_outcomes) * 100)

        resp = market_maker_client.get(
            "/proposals/quote",
            params={"liquidityParameter": liquidity, "numOutcomes": num_outcomes},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["initialFundingCents"] == expected
        assert data["liquidityParameter"] == liquidity
        assert data["numOutcomes"] == num_outcomes

    def test_quote_scales_with_num_outcomes(self, market_maker_client):
        """Quoted cost grows as ln(N) when number of outcomes increases."""
        liquidity = 200
        for n in [2, 5, 10, 20]:
            expected = int(liquidity * math.log(n) * 100)
            resp = market_maker_client.get(
                "/proposals/quote",
                params={"liquidityParameter": liquidity, "numOutcomes": n},
            )
            assert resp.status_code == 200
            assert resp.json()["initialFundingCents"] == expected

    def test_quote_scales_with_liquidity_parameter(self, market_maker_client):
        """Quoted cost scales linearly with the liquidity parameter."""
        num_outcomes = 4
        for b in [50, 100, 500, 1000]:
            expected = int(b * math.log(num_outcomes) * 100)
            resp = market_maker_client.get(
                "/proposals/quote",
                params={"liquidityParameter": b, "numOutcomes": num_outcomes},
            )
            assert resp.status_code == 200
            assert resp.json()["initialFundingCents"] == expected

    def test_quote_matches_actual_collateral_locked_on_publish(
        self, market_maker_client, admin_client
    ):
        """The quoted cost equals the initial_funding_cents stored when the market is published."""
        liquidity = 75
        outcomes_payload = [
            {"outcome": "A", "isCatchAll": False},
            {"outcome": "B", "isCatchAll": False},
            {"outcome": "C", "isCatchAll": False},
        ]
        num_outcomes = len(outcomes_payload)

        # Get quote first
        resp = market_maker_client.get(
            "/proposals/quote",
            params={"liquidityParameter": liquidity, "numOutcomes": num_outcomes},
        )
        assert resp.status_code == 200
        quoted_cents = resp.json()["initialFundingCents"]

        # Create, approve, publish
        resp = market_maker_client.post(
            "/proposals",
            json={
                "question": "Quote vs actual collateral test",
                "outcomes": outcomes_payload,
                "category": "general",
                "resolutionDate": "2030-12-31T23:59:59",
                "liquidityParameter": liquidity,
                "uiType": "bars-ordered",
            },
        )
        assert resp.status_code == 201
        proposal_id = resp.json()["id"]

        admin_client.post(f"/proposals/{proposal_id}/review", json={"approved": True})
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 200
        market_id = resp.json()["createdMarketId"]

        # Verify market's initial funding matches the quote
        resp = market_maker_client.get(f"/markets/maker/dashboard")
        assert resp.status_code == 200
        market_data = next(m for m in resp.json()["markets"] if m["id"] == market_id)
        assert market_data["initialFundingCents"] == quoted_cents

    def test_quote_requires_at_least_two_outcomes(self, market_maker_client):
        """numOutcomes < 2 is rejected with 422."""
        resp = market_maker_client.get(
            "/proposals/quote",
            params={"liquidityParameter": 100, "numOutcomes": 1},
        )
        assert resp.status_code == 422

    def test_quote_requires_positive_liquidity(self, market_maker_client):
        """liquidityParameter <= 0 is rejected with 422."""
        resp = market_maker_client.get(
            "/proposals/quote",
            params={"liquidityParameter": 0, "numOutcomes": 2},
        )
        assert resp.status_code == 422

    def test_quote_requires_authentication(self, user_client):
        """Unauthenticated requests are rejected with 401."""
        resp = user_client.get(
            "/proposals/quote",
            params={"liquidityParameter": 100, "numOutcomes": 2},
        )
        assert resp.status_code == 401


class TestProposalCreation:
    """Tests for creating market proposals."""

    def test_market_maker_can_create_proposal(self, market_maker_client):
        """Market makers can create proposals."""
        payload = {
            "question": "Will it rain tomorrow?",
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            "outcomes": [{"outcome": "Only one", "isCatchAll": False}],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
                "outcomes": [
                    {"outcome": "Yes", "isCatchAll": False},
                    {"outcome": "No", "isCatchAll": False},
                ],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
        assert data["status"] == "published"
        assert "createdMarketId" in data

    def test_cannot_publish_pending_proposal(self, market_maker_client):
        """Cannot publish a proposal that hasn't been approved."""
        # Create proposal (not approved)
        payload = {
            "question": "Test",
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            .filter(models.User.email == MARKET_MAKER_EMAIL)
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
            .filter(models.User.email == MARKET_MAKER_EMAIL)
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
            "outcomes": [
                {"outcome": "Yes", "isCatchAll": False},
                {"outcome": "No", "isCatchAll": False},
            ],
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
                "outcomes": [
                    {"outcome": "Yes", "isCatchAll": False},
                    {"outcome": "No", "isCatchAll": False},
                ],
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
        outcomes = [
            {"outcome": f"Outcome {i}", "value": float(i), "isCatchAll": False}
            for i in range(10)
        ]  # 10 outcomes
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
            .filter(models.User.email == MARKET_MAKER_EMAIL)
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


class TestProposalUITypes:
    """Test that different UI types propagate correctly through proposal flow."""

    def test_ui_types_propagate_to_markets(
        self, market_maker_client, admin_client, db_session
    ):
        """Verify all UI types work through proposal -> market flow."""
        ui_test_cases = [
            {
                "ui_type": "bars-ordered",
                "outcomes": [
                    {"outcome": "Option A"},
                    {"outcome": "Option B"},
                    {"outcome": "Option C"},
                ],
            },
            {
                "ui_type": "bars-categorical",
                "outcomes": [
                    {"outcome": "Cat 1"},
                    {"outcome": "Cat 2"},
                    {"outcome": "Cat 3"},
                ],
            },
            {
                "ui_type": "year",
                "outcomes": [
                    {"outcome": "2025"},
                    {"outcome": "2026"},
                    {"outcome": "Never", "isCatchAll": True},
                ],
            },
            {
                "ui_type": "quarter",
                "outcomes": [
                    {"outcome": "2026 Q1"},
                    {"outcome": "2026 Q2"},
                    {"outcome": "2026 Q3"},
                ],
            },
            {
                "ui_type": "month",
                "outcomes": [
                    {"outcome": "2026-01"},
                    {"outcome": "2026-02"},
                    {"outcome": "2026-03"},
                ],
            },
            {
                "ui_type": "day",
                "outcomes": [
                    {"outcome": "2026-03-01"},
                    {"outcome": "2026-03-02"},
                    {"outcome": "2026-03-03"},
                ],
            },
            {
                "ui_type": "interval",
                "outcomes": [
                    {"outcome": "0-10", "value": 0},
                    {"outcome": "10-20", "value": 10},
                    {"outcome": "20-30", "value": 20},
                ],
            },
        ]

        for test_case in ui_test_cases:
            ui_type = test_case["ui_type"]

            # Create proposal with specific UI type
            payload = {
                "question": f"Test {ui_type} market",
                "outcomes": test_case["outcomes"],
                "category": "test",
                "resolutionDate": "2030-12-31T23:59:59",
                "liquidityParameter": 50,
                "uiType": ui_type,
            }
            resp = market_maker_client.post("/proposals", json=payload)
            assert resp.status_code == 201, f"Failed to create {ui_type} proposal"
            proposal = resp.json()
            proposal_id = proposal["id"]

            # Verify proposal has correct UI type
            assert proposal["uiType"] == ui_type

            # Admin approves
            resp = admin_client.post(
                f"/proposals/{proposal_id}/review", json={"approved": True}
            )
            assert resp.status_code == 200

            # Market maker publishes
            resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
            assert resp.status_code == 200
            published_proposal = resp.json()

            # Verify market was created with correct UI type
            market_id = published_proposal["createdMarketId"]
            assert market_id is not None

            resp = market_maker_client.get(f"/markets/{market_id}")
            assert resp.status_code == 200
            market = resp.json()

            # Verify UI type propagated correctly
            assert (
                market["uiType"] == ui_type
            ), f"Expected {ui_type}, got {market['uiType']}"

            # Verify outcomes match
            assert len(market["securities"]) == len(test_case["outcomes"])

            # For interval type, verify values are present
            if ui_type == "interval":
                for security in market["securities"]:
                    assert "value" in security
                    assert isinstance(security["value"], (int, float))

    def test_interval_market_with_catch_all(
        self, market_maker_client, admin_client, db_session
    ):
        """Test interval market with catch-all outcome."""
        payload = {
            "question": "Temperature range with catch-all",
            "outcomes": [
                {"outcome": "0-50°F", "value": 0},
                {"outcome": "50-100°F", "value": 50},
                {
                    "outcome": "Above 100°F or never measured",
                    "value": 1e9,
                    "isCatchAll": True,
                },
            ],
            "category": "climate",
            "resolutionDate": "2030-12-31T23:59:59",
            "liquidityParameter": 75,
            "uiType": "interval",
        }

        # Create and approve proposal
        resp = market_maker_client.post("/proposals", json=payload)
        assert resp.status_code == 201
        proposal_id = resp.json()["id"]

        admin_client.post(f"/proposals/{proposal_id}/review", json={"approved": True})

        # Publish
        resp = market_maker_client.post(f"/proposals/{proposal_id}/publish")
        assert resp.status_code == 200

        market_id = resp.json()["createdMarketId"]
        resp = market_maker_client.get(f"/markets/{market_id}")
        market = resp.json()

        # Verify catch-all is properly marked
        catch_all_securities = [s for s in market["securities"] if s["isCatchAll"]]
        assert len(catch_all_securities) == 1
        assert "never measured" in catch_all_securities[0]["outcome"].lower()
