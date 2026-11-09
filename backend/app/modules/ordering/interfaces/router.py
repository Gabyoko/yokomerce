"""Endpoints de ordering (SPEC.md, sección 5). Validan, llaman al caso de uso y responden."""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, status

from app.modules.iam.public import CurrentUser, get_current_store, get_current_user
from app.modules.stores.public import Store
from app.shared.db import UnitOfWork, get_uow
from app.shared.openapi import json_body

from ..application import manage_orders
from ..application.place_order import place_order
from ..application.queries import get_public_order, to_public_order
from .schemas import CreateOrderInput, CreateOrderSuccess, Order, OrderNotesInput, PublicOrder

router = APIRouter(tags=["pedidos"])

_ERRORS = {
    400: {"description": '`{ ok: false, error: "validation", message, fields }`'},
    404: {"description": "La tienda no existe"},
    409: {"description": '`{ ok: false, error: "out_of_stock", message, items: [{ variantId, available }] }`'},
    429: {"description": '`{ ok: false, error: "rate_limited", message }`'},
}


@router.post(
    "/public/orders",
    status_code=status.HTTP_201_CREATED,
    response_model=CreateOrderSuccess,
    responses=_ERRORS,
    summary="Crear un pedido",
    openapi_extra=json_body(CreateOrderInput),
)
def create_order(
    uow: Annotated[UnitOfWork, Depends(get_uow)],
    # El cuerpo se valida en el caso de uso para responder con las claves del input ("items.0.quantity")
    body: Annotated[Any, Body()] = None,
) -> CreateOrderSuccess:
    order = place_order(uow, body)
    return CreateOrderSuccess(ok=True, order=to_public_order(order))


@router.get("/public/stores/{slug}/orders/{token}", response_model=PublicOrder, summary="Pedido por su link")
def read_public_order(slug: str, token: str, uow: Annotated[UnitOfWork, Depends(get_uow)]) -> PublicOrder:
    return get_public_order(uow, slug, token)


# --- Panel ---

Uow = Annotated[UnitOfWork, Depends(get_uow)]
MyStore = Annotated[Store, Depends(get_current_store)]
Me = Annotated[CurrentUser, Depends(get_current_user)]


@router.get("/me/orders", response_model=list[Order], summary="Mis pedidos, más recientes primero")
def list_my_orders(store: MyStore, uow: Uow, status: str | None = None, search: str | None = None) -> list[Order]:
    return manage_orders.list_orders(uow, store.id, status, search)


@router.get("/me/orders/{order_id}", response_model=Order, summary="Uno de mis pedidos")
def get_my_order(order_id: str, store: MyStore, uow: Uow) -> Order:
    return manage_orders.get_order(uow, store.id, order_id)


@router.patch(
    "/me/orders/{order_id}",
    response_model=Order,
    summary="Guardar la nota interna",
    openapi_extra=json_body(OrderNotesInput),
)
def update_my_order_notes(order_id: str, store: MyStore, uow: Uow, body: Annotated[Any, Body()] = None) -> Order:
    return manage_orders.update_notes(uow, store.id, order_id, body)


@router.post("/me/orders/{order_id}/confirm-payment", response_model=Order, summary="Nuevo → Pagado")
def confirm_payment(order_id: str, store: MyStore, user: Me, uow: Uow) -> Order:
    return manage_orders.confirm_payment(uow, store.id, order_id, user.name)


@router.post("/me/orders/{order_id}/start-preparing", response_model=Order, summary="Pagado → Preparando")
def start_preparing(order_id: str, store: MyStore, uow: Uow) -> Order:
    return manage_orders.start_preparing(uow, store.id, order_id)


@router.post("/me/orders/{order_id}/deliver", response_model=Order, summary="Preparando → Entregado")
def deliver(order_id: str, store: MyStore, uow: Uow) -> Order:
    return manage_orders.deliver(uow, store.id, order_id)


@router.post("/me/orders/{order_id}/cancel", response_model=Order, summary="Cancelar el pedido")
def cancel(order_id: str, store: MyStore, user: Me, uow: Uow) -> Order:
    return manage_orders.cancel(uow, store.id, order_id, user.name)
