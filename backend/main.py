from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import admin, auth, markets, proposals, trades, users
from core.config import settings
from core.database import init_db


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
    app.include_router(trades.router)

    @app.on_event("startup")
    def _init_db() -> None:
        init_db()

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
