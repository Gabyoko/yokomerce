"""Casos de uso del panel: ajuste manual de stock e historial (SPEC.md, sección 7)."""

from typing import Any

from app.modules.catalog.public import VariantRef, find_variant_of_store
from app.modules.stores.public import Store
from app.modules.subscriptions.public import can_see_stock_history
from app.shared.db import UnitOfWork
from app.shared.domain.time import utc_now
from app.shared.errors import Conflict, LimitReached, NotFound
from app.shared.validation import FieldErrors, is_int, is_object, text

from ..domain.stock_item import MovementType
from ..infrastructure import repository
from ..infrastructure.models import StockMovementModel

REASON_MAX = 60
MAX_STOCK = 99_999


def _own_variant(uow: UnitOfWork, store: Store, variant_id: str) -> VariantRef:
    """Solo variantes de la tienda de la sesión: las de otra tienda no existen para este dueño."""
    variant = find_variant_of_store(uow.session, store, variant_id)
    if variant is None:
        raise NotFound("No encontramos esta variante.")
    return variant


def adjust_stock(uow: UnitOfWork, store: Store, variant_id: str, body: Any, actor: str) -> StockMovementModel:
    """`in` suma, `out` resta, `adjust` fija el total. Nunca puede dejar el total por debajo de lo reservado."""
    variant = _own_variant(uow, store, variant_id)
    if variant.made_to_order:
        raise Conflict("Este producto es por encargo y no lleva control de stock.", code="made_to_order")

    data = body if is_object(body) else {}
    kind, quantity, reason = data.get("type"), data.get("quantity"), text(data.get("reason"))
    errors = FieldErrors()
    if kind not in ("in", "out", "adjust"):
        errors.add("type", "Elige si es ingreso, salida o ajuste.")
    if not is_int(quantity, 0 if kind == "adjust" else 1, MAX_STOCK):
        errors.add(
            "quantity", "Escribe el total exacto (0 o más)." if kind == "adjust" else "Escribe una cantidad mayor a 0."
        )
    if not reason or len(reason) > REASON_MAX:
        errors.add("reason", "Elige o escribe un motivo.")
    errors.throw_if_any("Revisa los datos del ajuste.")

    item = repository.load(uow.session, variant_id)
    movement = MovementType(kind)
    signed = item.apply(movement, quantity)
    repository.save(uow.session, item)
    row = repository.record_movement(
        uow.session,
        store_id=store.id,
        variant_id=variant_id,
        type=movement,
        quantity=signed,
        now=utc_now().replace(microsecond=0),
        reason=reason,
        created_by=actor,
    )
    uow.commit()
    return row


def list_movements(uow: UnitOfWork, store: Store, variant_id: str) -> list[StockMovementModel]:
    """Más recientes primero. Es una función del plan Pro."""
    _own_variant(uow, store, variant_id)
    if not can_see_stock_history(store.plan, store.plan_expires_at):
        raise LimitReached("El historial de stock es parte del plan Pro.", code="plan_required")
    return repository.movements_of(uow.session, variant_id)
