"""Crea la app: CORS, manejo de errores y los routers de cada módulo."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.shared.db import database_is_up
from app.shared.error_handlers import register_error_handlers
from app.shared.schemas import CamelModel


class HealthStatus(CamelModel):
    status: Literal["ok"]
    database: Literal["ok", "unavailable"]
    environment: str
    server_time: datetime


def check_database() -> bool:
    """Se separa como dependencia para poder reemplazarla en las pruebas."""
    return database_is_up()


health_router = APIRouter(tags=["salud"])


@health_router.get("/health", response_model=HealthStatus, summary="Estado de la API y de la base de datos")
def health(database_ok: Annotated[bool, Depends(check_database)]) -> HealthStatus:
    return HealthStatus(
        status="ok",
        database="ok" if database_ok else "unavailable",
        environment=get_settings().app_env,
        server_time=datetime.now(UTC),
    )


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Yokomerce API",
        version="0.1.0",
        description="Catálogo y pedidos por WhatsApp. Contrato en SPEC.md, secciones 4 y 5.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(health_router)
    # Routers de los módulos: se agregan en B2–B6
    return app


app = create_app()
