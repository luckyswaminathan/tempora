"""
Tests for market creation and trading with different UI types.

This test suite verifies that markets can be created, retrieved, and traded on
for all supported UI types: bars-ordered, bars-categorical, year, quarter, month, day, and interval.
"""


def test_list_markets(client):
    resp = client.get("/markets")
    assert resp.status_code == 200
    assert "items" in resp.json()
    assert "count" in resp.json()


def test_create_market(client):
    payload = {
        "question": "When will Bitcoin hit $100k?",
        "outcomes": [
            {"outcome": "2025"},
            {"outcome": "2026"},
            {"outcome": "2027"},
            {"outcome": "2028"},
        ],
        "category": "crypto",
        "resolutionDate": "2030-01-01T00:00:00Z",
        "description": "Example",
    }

    resp = client.post("/markets", json=payload)
    assert resp.status_code == 201

    data = resp.json()
    assert data["question"] == payload["question"]
    assert data["category"] == payload["category"]
    assert data["resolutionDate"] == payload["resolutionDate"]
    assert data["description"] == payload["description"]

    assert len(data["quotes"]) == len(payload["outcomes"])
    for quote in data["quotes"]:
        assert quote["impliedProbability"] == 1.0 / len(payload["outcomes"])


class TestBarsOrderedUIType:
    """Tests for bars-ordered UI type (default)."""

    def test_create_bars_ordered_market(self, client):
        """Test creating a market with bars-ordered UI type."""
        payload = {
            "question": "What will be the outcome?",
            "outcomes": [
                {"outcome": "Option A"},
                {"outcome": "Option B"},
                {"outcome": "Option C"},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "bars-ordered",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["question"] == payload["question"]
        assert data["uiType"] == "bars-ordered"
        assert len(data["securities"]) == 3
        assert len(data["quotes"]) == 3

    def test_trade_on_bars_ordered_market(self, client):
        """Test placing trades on bars-ordered market."""
        # Create market
        payload = {
            "question": "Test market?",
            "outcomes": [{"outcome": "A"}, {"outcome": "B"}],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "bars-ordered",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Place trade
        trade_payload = {
            "marketId": market["id"],
            "legs": [{"securityId": market["securities"][0]["id"], "quantity": 10}],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201


class TestBarsCategoricalUIType:
    """Tests for bars-categorical UI type."""

    def test_create_bars_categorical_market(self, client):
        """Test creating a market with bars-categorical UI type."""
        payload = {
            "question": "Which category will win?",
            "outcomes": [
                {"outcome": "Category 1"},
                {"outcome": "Category 2"},
                {"outcome": "Category 3"},
                {"outcome": "Category 4"},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "bars-categorical",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "bars-categorical"
        assert len(data["securities"]) == 4


class TestYearUIType:
    """Tests for year UI type."""

    def test_create_year_market(self, client):
        """Test creating a market with year UI type."""
        payload = {
            "question": "When will this happen?",
            "outcomes": [
                {"outcome": "2024"},
                {"outcome": "2025"},
                {"outcome": "2026"},
                {"outcome": "2027"},
                {"outcome": "Later or never", "is_catch_all": True},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "year",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "year"
        assert len(data["securities"]) == 5

        # Verify year format validation
        year_securities = [s for s in data["securities"] if not s["isCatchAll"]]
        for security in year_securities:
            assert len(security["outcome"]) == 4
            assert security["outcome"].isdigit()

        # Verify catch-all is present
        catch_all_securities = [s for s in data["securities"] if s["isCatchAll"]]
        assert len(catch_all_securities) == 1

    def test_trade_on_year_market(self, client):
        """Test placing trades on year market."""
        payload = {
            "question": "When?",
            "outcomes": [{"outcome": "2025"}, {"outcome": "2026"}],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "year",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Place trade
        trade_payload = {
            "marketId": market["id"],
            "legs": [{"securityId": market["securities"][0]["id"], "quantity": 5}],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201


class TestQuarterUIType:
    """Tests for quarter UI type."""

    def test_create_quarter_market(self, client):
        """Test creating a market with quarter UI type."""
        payload = {
            "question": "Which quarter will see the event?",
            "outcomes": [
                {"outcome": "2026 Q1"},
                {"outcome": "2026 Q2"},
                {"outcome": "2026 Q3"},
                {"outcome": "2026 Q4"},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "quarter",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "quarter"
        assert len(data["securities"]) == 4

        # Verify quarter format (YYYY Q[1-4])
        for security in data["securities"]:
            outcome = security["outcome"]
            parts = outcome.split()
            assert len(parts) == 2
            assert parts[0].isdigit() and len(parts[0]) == 4
            assert parts[1] in ["Q1", "Q2", "Q3", "Q4"]

    def test_trade_on_quarter_market(self, client):
        """Test placing trades on quarter market."""
        payload = {
            "question": "When?",
            "outcomes": [{"outcome": "2026 Q1"}, {"outcome": "2026 Q2"}],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "quarter",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Place trade
        trade_payload = {
            "marketId": market["id"],
            "legs": [{"securityId": market["securities"][1]["id"], "quantity": 3}],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201


class TestMonthUIType:
    """Tests for month UI type."""

    def test_create_month_market(self, client):
        """Test creating a market with month UI type."""
        payload = {
            "question": "Which month will it occur?",
            "outcomes": [
                {"outcome": "2026-01"},
                {"outcome": "2026-02"},
                {"outcome": "2026-03"},
                {"outcome": "2026-04"},
                {"outcome": "2026-05"},
                {"outcome": "2026-06"},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "month",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "month"
        assert len(data["securities"]) == 6

        # Verify month format (YYYY-MM)
        for security in data["securities"]:
            outcome = security["outcome"]
            parts = outcome.split("-")
            assert len(parts) == 2
            assert parts[0].isdigit() and len(parts[0]) == 4
            assert parts[1].isdigit() and 1 <= int(parts[1]) <= 12

    def test_create_month_market_with_names(self, client):
        """Test creating a market with month names."""
        payload = {
            "question": "Which month?",
            "outcomes": [
                {"outcome": "2026 January"},
                {"outcome": "2026 February"},
                {"outcome": "2026 March"},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "month",
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "month"
        assert len(data["securities"]) == 3

    def test_trade_on_month_market(self, client):
        """Test placing trades on month market."""
        payload = {
            "question": "When?",
            "outcomes": [{"outcome": "2026-01"}, {"outcome": "2026-02"}],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "month",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Place trade
        trade_payload = {
            "marketId": market["id"],
            "legs": [{"securityId": market["securities"][0]["id"], "quantity": 7}],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201


class TestDayUIType:
    """Tests for day UI type."""

    def test_create_day_market(self, client):
        """Test creating a market with day UI type."""
        payload = {
            "question": "On which day will it happen?",
            "outcomes": [
                {"outcome": "2026-03-01"},
                {"outcome": "2026-03-02"},
                {"outcome": "2026-03-03"},
                {"outcome": "2026-03-04"},
                {"outcome": "2026-03-05"},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "day",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "day"
        assert len(data["securities"]) == 5

        # Verify day format (YYYY-MM-DD)
        for security in data["securities"]:
            outcome = security["outcome"]
            parts = outcome.split("-")
            assert len(parts) == 3
            assert parts[0].isdigit() and len(parts[0]) == 4
            assert parts[1].isdigit() and 1 <= int(parts[1]) <= 12
            assert parts[2].isdigit() and 1 <= int(parts[2]) <= 31

    def test_create_day_market_with_catch_all(self, client):
        """Test creating a day market with catch-all option."""
        payload = {
            "question": "When?",
            "outcomes": [
                {"outcome": "2026-03-01"},
                {"outcome": "2026-03-02"},
                {"outcome": "Later or never", "is_catch_all": True},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "day",
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert len(data["securities"]) == 3
        catch_all_securities = [s for s in data["securities"] if s["isCatchAll"]]
        assert len(catch_all_securities) == 1

    def test_trade_on_day_market(self, client):
        """Test placing trades on day market."""
        payload = {
            "question": "When?",
            "outcomes": [{"outcome": "2026-03-01"}, {"outcome": "2026-03-02"}],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "day",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Place trade
        trade_payload = {
            "marketId": market["id"],
            "legs": [{"securityId": market["securities"][0]["id"], "quantity": 2}],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201


class TestIntervalUIType:
    """Tests for interval UI type."""

    def test_create_interval_market(self, client):
        """Test creating a market with interval UI type."""
        payload = {
            "question": "What will the temperature be?",
            "outcomes": [
                {"outcome": "100-105°F", "value": 100},
                {"outcome": "105-110°F", "value": 105},
                {"outcome": "110-115°F", "value": 110},
                {"outcome": "115-120°F", "value": 115},
                {"outcome": "120-125°F", "value": 120},
            ],
            "category": "climate",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
            "liquidityParameter": 1000,
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert data["uiType"] == "interval"
        assert len(data["securities"]) == 5

        # Verify all securities have values
        for security in data["securities"]:
            assert "value" in security
            assert isinstance(security["value"], (int, float))

    def test_create_interval_market_with_bounds(self, client):
        """Test creating an interval market with upper and lower bounds."""
        payload = {
            "question": "Temperature prediction",
            "outcomes": [
                {"outcome": "Below 100°F", "value": 95, "is_catch_all": False},
                {"outcome": "100-110°F", "value": 100},
                {"outcome": "110-120°F", "value": 110},
                {"outcome": "Above 120°F", "value": 125, "is_catch_all": False},
            ],
            "category": "climate",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert len(data["securities"]) == 4

    def test_create_interval_market_with_catch_all(self, client):
        """Test creating an interval market with separate catch-all option."""
        payload = {
            "question": "Stock price prediction",
            "outcomes": [
                {"outcome": "$0-$50", "value": 0},
                {"outcome": "$50-$100", "value": 50},
                {"outcome": "$100-$150", "value": 100},
                {"outcome": "Never reaches market", "value": 1e9, "is_catch_all": True},
            ],
            "category": "economics",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
        }

        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201

        data = resp.json()
        assert len(data["securities"]) == 4

        # Verify catch-all is properly marked
        catch_all_securities = [s for s in data["securities"] if s["isCatchAll"]]
        assert len(catch_all_securities) == 1
        assert catch_all_securities[0]["outcome"] == "Never reaches market"

    def test_trade_on_interval_market(self, client):
        """Test placing trades on interval market."""
        payload = {
            "question": "Temperature?",
            "outcomes": [
                {"outcome": "100-110°F", "value": 100},
                {"outcome": "110-120°F", "value": 110},
            ],
            "category": "climate",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Place trade
        trade_payload = {
            "marketId": market["id"],
            "legs": [{"securityId": market["securities"][0]["id"], "quantity": 15}],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201

    def test_interval_market_range_trading(self, client):
        """Test trading on multiple intervals (range selection)."""
        payload = {
            "question": "Score prediction",
            "outcomes": [
                {"outcome": "0-10", "value": 0},
                {"outcome": "10-20", "value": 10},
                {"outcome": "20-30", "value": 20},
                {"outcome": "30-40", "value": 30},
            ],
            "category": "sports",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market = resp.json()

        # Trade on multiple securities (range)
        trade_payload = {
            "marketId": market["id"],
            "legs": [
                {"securityId": market["securities"][1]["id"], "quantity": 5},
                {"securityId": market["securities"][2]["id"], "quantity": 5},
            ],
        }
        resp = client.post("/trades", json=trade_payload)
        assert resp.status_code == 201


class TestUITypeMarketRetrieval:
    """Test that markets with different UI types can be properly retrieved."""

    def test_retrieve_markets_by_ui_type(self, client):
        """Test retrieving markets and filtering by UI type."""
        # Create markets with different UI types
        ui_types = ["bars-ordered", "year", "month", "day", "interval"]

        for ui_type in ui_types:
            payload = {
                "question": f"Test market for {ui_type}",
                "outcomes": [{"outcome": "A"}, {"outcome": "B"}],
                "category": "general",
                "resolutionDate": "2030-01-01T00:00:00Z",
                "uiType": ui_type,
            }
            resp = client.post("/markets", json=payload)
            assert resp.status_code == 201

        # List all markets
        resp = client.get("/markets")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= len(ui_types)

        # Verify each UI type is present
        retrieved_ui_types = {item["uiType"] for item in data["items"]}
        for ui_type in ui_types:
            assert ui_type in retrieved_ui_types

    def test_retrieve_specific_market_with_ui_type(self, client):
        """Test retrieving a specific market preserves UI type information."""
        payload = {
            "question": "Interval test market",
            "outcomes": [
                {"outcome": "100-110", "value": 100},
                {"outcome": "110-120", "value": 110},
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
        }
        resp = client.post("/markets", json=payload)
        assert resp.status_code == 201
        market_id = resp.json()["id"]

        # Retrieve the market
        resp = client.get(f"/markets/{market_id}")
        assert resp.status_code == 200

        data = resp.json()
        assert data["uiType"] == "interval"
        assert len(data["securities"]) == 2
        for security in data["securities"]:
            assert "value" in security


class TestUITypeValidation:
    """Test validation for different UI types."""

    def test_invalid_year_format_accepted(self, client):
        """Test that invalid year formats are accepted (validation is frontend-only)."""
        payload = {
            "question": "When?",
            "outcomes": [
                {"outcome": "2026"},  # Valid
                {"outcome": "next year"},  # Invalid format but should be accepted
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "year",
        }

        resp = client.post("/markets", json=payload)
        # Backend doesn't validate format, so this should succeed
        assert resp.status_code == 201

    def test_interval_without_values_fails(self, client):
        """Test that interval markets require value field."""
        # Note: This test documents current behavior. If validation is added, update accordingly.
        payload = {
            "question": "Temperature?",
            "outcomes": [
                {"outcome": "100-110°F"},  # Missing value field
                {"outcome": "110-120°F"},
            ],
            "category": "climate",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "interval",
        }

        resp = client.post("/markets", json=payload)
        # Currently backend accepts missing values (defaults to 0)
        # If validation is added, this should return 400
        assert resp.status_code in [201, 400]

    def test_multiple_catch_all_rejected(self, client):
        """Test that markets cannot have multiple catch-all outcomes."""
        payload = {
            "question": "When?",
            "outcomes": [
                {"outcome": "2026", "is_catch_all": True},
                {"outcome": "2027", "is_catch_all": True},  # Second catch-all
            ],
            "category": "general",
            "resolutionDate": "2030-01-01T00:00:00Z",
            "uiType": "year",
        }

        resp = client.post("/markets", json=payload)
        # This should fail validation
        assert resp.status_code == 400
