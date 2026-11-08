"""Crea la app: CORS, manejo de errores y los routers de cada módulo."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.jobs.expire_reservations import start_in_background
from app.modules.catalog.images import UPLOADS_ROUTE
from app.modules.catalog.router import router as catalog_router
from app.modules.inventory.interfaces.router import router as inventory_router
from app.modules.inventory.public import register_event_handlers as register_inventory_handlers
from app.modules.ordering.interfaces.router import router as ordering_router
from app.modules.reporting.router import router as reporting_router
from app.modules.stores.router import router as stores_router
from app.shared.db import database_is_up
from app.shared.error_handlers import register_error_handlers
from app.shared.events import bus
from app.shared.openapi import add_request_models
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


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # En las pruebas no corre sola: la prueban llamándola directamente
    stop = None if get_settings().app_env == "test" else start_in_background()
    yield
    if stop is not None:
        stop.set()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        lifespan=lifespan,
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
    app.include_router(catalog_router)
    app.include_router(inventory_router)
    app.include_router(ordering_router)
    app.include_router(reporting_router)
    app.include_router(stores_router)

    # Eventos entre módulos (se limpia antes para no registrar dos veces si se crea otra app en las pruebas)
    bus.clear()
    register_inventory_handlers(bus)

    if settings.storage_backend == "local":
        uploads = Path(settings.uploads_dir)
        uploads.mkdir(parents=True, exist_ok=True)
        app.mount(UPLOADS_ROUTE, StaticFiles(directory=uploads), name="uploads")

    add_request_models(app)
    return app


app = create_app()
