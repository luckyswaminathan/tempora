from contextlib import asynccontextmanager
from threading import Event, Thread

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import (
    admin,
    auth,
    history,
    markets,
    notifications,
    orders,
    proposals,
    users,
)
from core.config import settings
from core.database import SessionLocal, init_db
from services.markets import MarketService
from services.orders import OrderService


def _run_overdue_market_watcher(stop_event: Event) -> None:
    while not stop_event.is_set():
        with SessionLocal() as session:
            MarketService(session).close_overdue_markets_and_notify_admins()
        stop_event.wait(60)


def _run_expired_order_watcher(stop_event: Event) -> None:
    """Background worker to auto-cancel expired limit orders."""
    while not stop_event.is_set():
        with SessionLocal() as session:
            OrderService(session).auto_cancel_expired_orders()
        stop_event.wait(30)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    init_db()

    if settings.environment == "test":
        yield
        return

    stop_event = Event()
    watcher = Thread(
        target=_run_overdue_market_watcher,
        args=(stop_event,),
        daemon=True,
        name="overdue-market-watcher",
    )
    app.state.overdue_market_watcher_stop_event = stop_event
    app.state.overdue_market_watcher = watcher
    watcher.start()

    expired_order_stop_event = Event()
    expired_order_watcher = Thread(
        target=_run_expired_order_watcher,
        args=(expired_order_stop_event,),
        daemon=True,
        name="expired-order-watcher",
    )
    app.state.expired_order_watcher_stop_event = expired_order_stop_event
    app.state.expired_order_watcher = expired_order_watcher
    expired_order_watcher.start()

    try:
        yield
    finally:
        overdue_stop_event = getattr(
            app.state, "overdue_market_watcher_stop_event", None
        )
        overdue_watcher = getattr(app.state, "overdue_market_watcher", None)
        if overdue_stop_event:
            overdue_stop_event.set()
        if overdue_watcher and overdue_watcher.is_alive():
            overdue_watcher.join(timeout=2)

        expired_stop_event = getattr(
            app.state, "expired_order_watcher_stop_event", None
        )
        expired_watcher = getattr(app.state, "expired_order_watcher", None)
        if expired_stop_event:
            expired_stop_event.set()
        if expired_watcher and expired_watcher.is_alive():
            expired_watcher.join(timeout=2)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Tempora Prediction Markets API",
        version="0.1.0",
        summary="Backend services for the Tempora prediction market frontend",
        lifespan=_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(admin.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(markets.router)
    app.include_router(proposals.router)
    app.include_router(orders.router)
    app.include_router(history.router)
    app.include_router(notifications.router)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
