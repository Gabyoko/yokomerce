"""Endpoints de stock del panel (SPEC.md, sección 5). Validan, llaman al caso de uso y responden."""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, status

from app.modules.catalog.public import get_variant_admin
from app.modules.iam.public import CurrentUser, get_current_store, get_current_user
from app.modules.stores.public import Store
from app.shared.db import UnitOfWork, get_uow
from app.shared.openapi import json_body

from ..application.adjust_stock import adjust_stock, list_movements
from .schemas import StockAdjustmentInput, StockAdjustmentResult, StockMovement

router = APIRouter(tags=["stock"])


@router.post(
    "/me/variants/{variant_id}/adjustments",
    status_code=status.HTTP_201_CREATED,
    response_model=StockAdjustmentResult,
    summary="Ajustar el stock de una variante",
    openapi_extra=json_body(StockAdjustmentInput),
)
def post_adjustment(
    variant_id: str,
    store: Annotated[Store, Depends(get_current_store)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    uow: Annotated[UnitOfWork, Depends(get_uow)],
    body: Annotated[Any, Body()] = None,
) -> StockAdjustmentResult:
    movement = adjust_stock(uow, store, variant_id, body, user.name)
    return StockAdjustmentResult(
        movement=StockMovement.model_validate(movement),
        variant=get_variant_admin(uow.session, store, variant_id),
    )


@router.get(
    "/me/variants/{variant_id}/movements",
    response_model=list[StockMovement],
    summary="Historial de stock de una variante (Pro)",
)
def get_movements(
    variant_id: str,
    store: Annotated[Store, Depends(get_current_store)],
    uow: Annotated[UnitOfWork, Depends(get_uow)],
) -> list[StockMovement]:
    return [StockMovement.model_validate(row) for row in list_movements(uow, store, variant_id)]
