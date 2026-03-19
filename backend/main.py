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


def _run_overdue_market_watcher(stop_event: Event) -> None:
    while not stop_event.is_set():
        with SessionLocal() as session:
            MarketService(session).close_overdue_markets_and_notify_admins()
        stop_event.wait(60)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Tempora Prediction Markets API",
        version="0.1.0",
        summary="Backend services for the Tempora prediction market frontend",
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

    @app.on_event("startup")
    def _init_db() -> None:
        init_db()
        if settings.environment == "test":
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

    @app.on_event("shutdown")
    def _shutdown_watcher() -> None:
        stop_event = getattr(app.state, "overdue_market_watcher_stop_event", None)
        watcher = getattr(app.state, "overdue_market_watcher", None)
        if stop_event:
            stop_event.set()
        if watcher and watcher.is_alive():
            watcher.join(timeout=2)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
