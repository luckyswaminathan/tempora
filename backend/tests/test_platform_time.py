"""
Tests for PlatformTimeService and settlement todo lifecycle.

SCOPE:
- Platform time get / set / advance via service and API
- check_and_close_markets: markets past resolution_date → CLOSED + todo created
- Idempotency: advancing time again does not duplicate todos
- get_settlement_todos_for_user: filtering, is_overdue, hours_remaining
- mark_todo_settled: settled_at stamped, excluded from default listing
- API endpoints: GET/POST /admin/time, POST /admin/time/advance
- API endpoint: GET /markets/maker/todos
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from core import models
from services.platform_time import PlatformTimeService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PAST = datetime(2020, 1, 1, tzinfo=timezone.utc)
FUTURE = datetime(2030, 1, 1, tzinfo=timezone.utc)


def _strip_tz(dt: datetime | None) -> datetime | None:
    """Strip timezone for comparison against SQLite-returned naive datetimes."""
    return dt.replace(tzinfo=None) if dt is not None else None


def _make_market(
    db_session, creator_id: str, resolution_date: datetime
) -> models.Market:
    """Seed a minimal OPEN market directly into the DB."""
    market = models.Market(
        id=str(uuid4()),
        question=f"Market resolving {resolution_date.date()}",
        category="test",
        description="",
        resolution_date=resolution_date,
        status=models.MarketStatus.OPEN,
        tags=[],
        liquidity_parameter=10,
        ui_type="binary",
        creator_id=creator_id,
        initial_funding_cents=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(market)
    db_session.flush()

    for outcome in ("Yes", "No"):
        db_session.add(
            models.Security(
                id=str(uuid4()),
                market_id=market.id,
                outcome=outcome,
                value=0.0,
                is_catch_all=False,
                created_at=datetime.now(timezone.utc),
            )
        )

    db_session.commit()
    db_session.refresh(market)
    return market


# ---------------------------------------------------------------------------
# PlatformTimeService unit tests
# ---------------------------------------------------------------------------


class TestGetCurrentTime:
    def test_returns_utc_datetime(self, db_session):
        svc = PlatformTimeService(db_session)
        t = svc.get_current_time()
        assert isinstance(t, datetime)

    def test_creates_singleton_on_first_call(self, db_session):
        svc = PlatformTimeService(db_session)
        svc.get_current_time()
        count = db_session.query(models.PlatformState).count()
        assert count == 1

    def test_second_call_does_not_create_duplicate(self, db_session):
        svc = PlatformTimeService(db_session)
        svc.get_current_time()
        svc.get_current_time()
        assert db_session.query(models.PlatformState).count() == 1


class TestSetCurrentTime:
    def test_set_absolute_time(self, db_session):
        svc = PlatformTimeService(db_session)
        target = datetime(2025, 6, 15, 12, 0, tzinfo=timezone.utc)
        result = svc.set_current_time(target)
        assert _strip_tz(result) == _strip_tz(target)
        assert _strip_tz(svc.get_current_time()) == _strip_tz(target)

    def test_naive_datetime_gets_utc(self, db_session):
        svc = PlatformTimeService(db_session)
        naive = datetime(2025, 6, 15, 12, 0)
        result = svc.set_current_time(naive)
        # Naive input should be stored as 12:00 UTC (value unchanged)
        assert _strip_tz(result) == naive

    def test_set_time_persists_across_new_service_instance(self, db_session):
        target = datetime(2025, 3, 1, tzinfo=timezone.utc)
        PlatformTimeService(db_session).set_current_time(target)
        assert _strip_tz(
            PlatformTimeService(db_session).get_current_time()
        ) == _strip_tz(target)


class TestAdvanceTime:
    def test_advance_by_hours(self, db_session):
        svc = PlatformTimeService(db_session)
        start = datetime(2025, 1, 1, 0, 0, tzinfo=timezone.utc)
        svc.set_current_time(start)
        result = svc.advance_time(hours=3)
        assert _strip_tz(result) == _strip_tz(start + timedelta(hours=3))

    def test_advance_by_days(self, db_session):
        svc = PlatformTimeService(db_session)
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        svc.set_current_time(start)
        result = svc.advance_time(days=7)
        assert _strip_tz(result) == _strip_tz(start + timedelta(days=7))

    def test_advance_by_combined_delta(self, db_session):
        svc = PlatformTimeService(db_session)
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        svc.set_current_time(start)
        result = svc.advance_time(days=1, hours=6, minutes=30)
        assert _strip_tz(result) == _strip_tz(
            start + timedelta(days=1, hours=6, minutes=30)
        )


# ---------------------------------------------------------------------------
# check_and_close_markets
# ---------------------------------------------------------------------------


class TestCheckAndCloseMarkets:
    def test_market_past_resolution_gets_closed(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        db_session.refresh(market)

        assert market.status == models.MarketStatus.CLOSED

    def test_market_not_yet_due_stays_open(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, FUTURE)

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        db_session.refresh(market)

        assert market.status == models.MarketStatus.OPEN

    def test_closing_creates_settlement_todo(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        todo = (
            db_session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id == market.id)
            .first()
        )
        assert todo is not None
        assert todo.market_maker_id == market_maker_user.id

    def test_todo_deadline_is_resolution_date_plus_deadline_hours(
        self, db_session, market_maker_user
    ):
        from core.config import settings

        svc = PlatformTimeService(db_session)
        resolution = datetime(2024, 6, 1, tzinfo=timezone.utc)
        market = _make_market(db_session, market_maker_user.id, resolution)

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        todo = (
            db_session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id == market.id)
            .first()
        )
        expected_deadline = resolution + timedelta(
            hours=settings.settlement_deadline_hours
        )
        assert _strip_tz(todo.deadline) == _strip_tz(expected_deadline)

    def test_advancing_time_again_does_not_duplicate_todo(
        self, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        _make_market(db_session, market_maker_user.id, PAST)

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        svc.advance_time(days=1)

        count = db_session.query(models.SettlementTodo).count()
        assert count == 1

    def test_already_closed_market_does_not_get_new_todo(
        self, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        market.status = models.MarketStatus.CLOSED
        db_session.commit()

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        count = (
            db_session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id == market.id)
            .count()
        )
        assert count == 0

    def test_multiple_markets_each_get_own_todo(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        m1 = _make_market(db_session, market_maker_user.id, PAST)
        m2 = _make_market(
            db_session, market_maker_user.id, datetime(2021, 1, 1, tzinfo=timezone.utc)
        )

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        market_ids = {m1.id, m2.id}
        todos = (
            db_session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id.in_(market_ids))
            .all()
        )
        assert len(todos) == 2


# ---------------------------------------------------------------------------
# get_settlement_todos_for_user
# ---------------------------------------------------------------------------


class TestGetSettlementTodosForUser:
    def test_returns_todos_for_correct_user_only(
        self, db_session, market_maker_user, admin_user
    ):
        svc = PlatformTimeService(db_session)
        _make_market(db_session, market_maker_user.id, PAST)
        _make_market(db_session, admin_user.id, PAST)

        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        assert response.count == 1
        assert all(t.market_maker_id == market_maker_user.id for t in response.todos)

    def test_excludes_settled_by_default(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        svc.mark_todo_settled(market.id)

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        assert response.count == 0

    def test_includes_settled_when_requested(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        svc.mark_todo_settled(market.id)

        response = svc.get_settlement_todos_for_user(
            market_maker_user.id, include_settled=True
        )
        assert response.count == 1
        assert response.todos[0].settled_at is not None

    def test_overdue_flag_when_past_deadline(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        from core.config import settings

        resolution = datetime(2020, 1, 1, tzinfo=timezone.utc)
        _make_market(db_session, market_maker_user.id, resolution)

        # Advance well past the deadline
        deadline = resolution + timedelta(hours=settings.settlement_deadline_hours)
        svc.set_current_time(deadline + timedelta(hours=1))

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        assert response.todos[0].is_overdue is True

    def test_not_overdue_when_before_deadline(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        resolution = datetime(2024, 12, 1, tzinfo=timezone.utc)
        _make_market(db_session, market_maker_user.id, resolution)

        # Set time just past resolution but well before deadline
        svc.set_current_time(resolution + timedelta(minutes=1))

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        assert response.todos[0].is_overdue is False

    def test_hours_remaining_is_positive_before_deadline(
        self, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        from core.config import settings

        resolution = datetime(2024, 12, 1, tzinfo=timezone.utc)
        _make_market(db_session, market_maker_user.id, resolution)

        # Set time 1 hour past resolution (deadline is several hours away)
        svc.set_current_time(resolution + timedelta(hours=1))

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        hours = response.todos[0].hours_remaining
        assert hours is not None
        assert hours == pytest.approx(settings.settlement_deadline_hours - 1, abs=0.01)

    def test_hours_remaining_is_none_when_settled(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        svc.mark_todo_settled(market.id)

        response = svc.get_settlement_todos_for_user(
            market_maker_user.id, include_settled=True
        )
        assert response.todos[0].hours_remaining is None

    def test_platform_time_field_matches_current_time(
        self, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        target = datetime(2025, 5, 5, tzinfo=timezone.utc)
        svc.set_current_time(target)

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        assert response.platform_time == target

    def test_todos_ordered_by_deadline(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        _make_market(
            db_session, market_maker_user.id, datetime(2022, 6, 1, tzinfo=timezone.utc)
        )
        _make_market(
            db_session, market_maker_user.id, datetime(2021, 1, 1, tzinfo=timezone.utc)
        )
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        response = svc.get_settlement_todos_for_user(market_maker_user.id)
        deadlines = [t.deadline for t in response.todos]
        assert deadlines == sorted(deadlines)


# ---------------------------------------------------------------------------
# mark_todo_settled
# ---------------------------------------------------------------------------


class TestMarkTodoSettled:
    def test_returns_none_for_unknown_market(self, db_session):
        svc = PlatformTimeService(db_session)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        result = svc.mark_todo_settled("nonexistent-market-id")
        assert result is None

    def test_settled_at_stamped_with_current_platform_time(
        self, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        platform_now = datetime(2025, 3, 10, tzinfo=timezone.utc)
        svc.set_current_time(platform_now)

        result = svc.mark_todo_settled(market.id)

        assert result is not None
        assert result.settled_at == platform_now

    def test_is_overdue_always_false_on_settled(self, db_session, market_maker_user):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        # Advance far past deadline
        from core.config import settings

        resolution = PAST
        svc.set_current_time(
            resolution + timedelta(hours=settings.settlement_deadline_hours + 100)
        )

        result = svc.mark_todo_settled(market.id)
        assert result.is_overdue is False

    def test_idempotent_settled_at_does_not_change_on_re_settle(
        self, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        first_settle_time = datetime(2025, 3, 10, tzinfo=timezone.utc)
        svc.set_current_time(first_settle_time)
        svc.mark_todo_settled(market.id)

        # Advance time then try to settle again
        svc.advance_time(days=1)
        svc.mark_todo_settled(market.id)

        todo = (
            db_session.query(models.SettlementTodo)
            .filter(models.SettlementTodo.market_id == market.id)
            .first()
        )
        assert _strip_tz(todo.settled_at) == _strip_tz(first_settle_time)


# ---------------------------------------------------------------------------
# API tests — admin time endpoints
# ---------------------------------------------------------------------------


class TestAdminTimeAPI:
    def test_get_time_returns_current_time(self, admin_client, db_session):
        svc = PlatformTimeService(db_session)
        target = datetime(2025, 9, 1, tzinfo=timezone.utc)
        svc.set_current_time(target)

        resp = admin_client.get("/admin/time")
        assert resp.status_code == 200
        data = resp.json()
        assert "currentTime" in data or "current_time" in data

    def test_set_time_via_api(self, admin_client):
        resp = admin_client.post(
            "/admin/time", json={"current_time": "2025-07-04T00:00:00Z"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "2025-07-04" in body.get("current_time", "") or "2025-07-04" in str(body)

    def test_advance_time_returns_previous_and_new(self, admin_client, db_session):
        svc = PlatformTimeService(db_session)
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        svc.set_current_time(start)

        resp = admin_client.post("/admin/time/advance", json={"hours": 24})
        assert resp.status_code == 200
        body = resp.json()
        assert "previous_time" in body
        assert "current_time" in body
        assert "markets_closed" in body

    def test_advance_time_reports_closed_markets(
        self, admin_client, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        resolution = datetime(2025, 6, 1, tzinfo=timezone.utc)
        _make_market(db_session, market_maker_user.id, resolution)

        # Start before resolution
        svc.set_current_time(datetime(2025, 5, 31, tzinfo=timezone.utc))

        # Advance past resolution
        resp = admin_client.post("/admin/time/advance", json={"days": 2})
        assert resp.status_code == 200
        assert resp.json()["markets_closed"] == 1

    def test_non_admin_cannot_set_time(self, user_client):
        resp = user_client.post(
            "/admin/time", json={"current_time": "2025-07-04T00:00:00Z"}
        )
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# API tests — market maker todos endpoint
# ---------------------------------------------------------------------------


class TestMarketMakerTodosAPI:
    def test_todos_endpoint_returns_list(self, market_maker_client):
        resp = market_maker_client.get("/markets/maker/todos")
        assert resp.status_code == 200
        body = resp.json()
        assert "todos" in body
        assert "count" in body
        assert "platform_time" in body

    def test_todos_includes_overdue_field(
        self, market_maker_client, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        _make_market(db_session, market_maker_user.id, PAST)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))

        resp = market_maker_client.get("/markets/maker/todos")
        assert resp.status_code == 200
        todo = resp.json()["todos"][0]
        assert "isOverdue" in todo or "is_overdue" in todo

    def test_settled_todos_excluded_by_default(
        self, market_maker_client, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        svc.mark_todo_settled(market.id)

        resp = market_maker_client.get("/markets/maker/todos")
        assert resp.json()["count"] == 0

    def test_settled_todos_included_with_flag(
        self, market_maker_client, db_session, market_maker_user
    ):
        svc = PlatformTimeService(db_session)
        market = _make_market(db_session, market_maker_user.id, PAST)
        svc.set_current_time(datetime(2025, 1, 1, tzinfo=timezone.utc))
        svc.mark_todo_settled(market.id)

        resp = market_maker_client.get("/markets/maker/todos?include_settled=true")
        assert resp.json()["count"] == 1

    def test_non_market_maker_cannot_access_todos(self, user_client):
        resp = user_client.get("/markets/maker/todos")
        assert resp.status_code in (401, 403)
