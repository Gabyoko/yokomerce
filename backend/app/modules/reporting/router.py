"""Endpoint de métricas del panel (SPEC.md, sección 5)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.iam.public import get_current_store
from app.modules.stores.public import Store
from app.shared.db import UnitOfWork, get_uow

from .queries import get_dashboard_stats
from .schemas import DashboardStats

router = APIRouter(tags=["métricas"])


@router.get("/me/stats", response_model=DashboardStats, summary="Métricas de mi tienda")
def get_my_stats(
    store: Annotated[Store, Depends(get_current_store)],
    uow: Annotated[UnitOfWork, Depends(get_uow)],
) -> DashboardStats:
    return get_dashboard_stats(uow.session, store)
