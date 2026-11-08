"""
Casos de uso del panel de pedidos. Solo orquestan: las reglas están en el agregado Order y el stock
lo mueve inventory al recibir los eventos, en la misma transacción.

El pedido se bloquea mientras cambia de estado: dos "Confirmar pago" a la vez no pueden descontar el
stock dos veces. El segundo espera, ve el estado nuevo y recibe el error de transición.
"""

import unicodedata
from collections.abc import Callable
from datetime import datetime
from typing import Any

from app.shared.db import UnitOfWork
from app.shared.domain.time import utc_now
from app.shared.errors import NotFound, ValidationFailed

from ..domain.order import Order, OrderStatus
from ..infrastructure import repository
from ..interfaces.schemas import Order as OrderOut
from .queries import to_order

NOTES_MAX = 500


def _now() -> datetime:
    return utc_now().replace(microsecond=0)


def _save(uow: UnitOfWork, order: Order) -> None:
    repository.save(uow.session, order)
    uow.publish(*order.pull_events())  # type: ignore[arg-type]
    uow.commit()


def _change(uow: UnitOfWork, store_id: str, order_id: str, change: Callable[[Order, datetime], None]) -> OrderOut:
    """Carga el pedido de ESTA tienda con bloqueo, aplica el cambio y guarda."""
    order = repository.get_for_update(uow.session, store_id, order_id)
    if order is None:
        raise NotFound("No encontramos este pedido.")
    now = _now()
    # Entre dos pasadas de la tarea de vencimiento, una reserva ya pasada no debe poder confirmarse
    if order.is_reservation_over(now):
        order.expire(now)
        _save(uow, order)
    change(order, now)
    _save(uow, order)
    return to_order(order)


def confirm_payment(uow: UnitOfWork, store_id: str, order_id: str, actor: str) -> OrderOut:
    return _change(uow, store_id, order_id, lambda order, now: order.confirm_payment(now, actor))


def start_preparing(uow: UnitOfWork, store_id: str, order_id: str) -> OrderOut:
    return _change(uow, store_id, order_id, lambda order, now: order.start_preparing())


def deliver(uow: UnitOfWork, store_id: str, order_id: str) -> OrderOut:
    return _change(uow, store_id, order_id, lambda order, now: order.deliver(now))


def cancel(uow: UnitOfWork, store_id: str, order_id: str, actor: str) -> OrderOut:
    return _change(uow, store_id, order_id, lambda order, now: order.cancel(now, actor))


def get_order(uow: UnitOfWork, store_id: str, order_id: str) -> OrderOut:
    order = repository.get(uow.session, store_id, order_id)
    if order is None:
        raise NotFound("No encontramos este pedido.")
    return to_order(order)


def update_notes(uow: UnitOfWork, store_id: str, order_id: str, body: Any) -> OrderOut:
    """Nota interna del negocio (el cliente no la ve)."""
    order = repository.get_for_update(uow.session, store_id, order_id)
    if order is None:
        raise NotFound("No encontramos este pedido.")
    notes = body.get("notes", ...) if isinstance(body, dict) else ...
    if notes is not None and not isinstance(notes, str):
        raise ValidationFailed("La nota no es válida.", fields={"notes": "Escribe una nota o déjala vacía."})
    clean = (notes or "").strip()
    if len(clean) > NOTES_MAX:
        raise ValidationFailed("La nota es muy larga.", fields={"notes": f"Máximo {NOTES_MAX} letras."})
    order.notes = clean or None
    _save(uow, order)
    return to_order(order)


def _normalize(value: str) -> str:
    """Minúsculas y sin tildes, para buscar "maria" y encontrar "María"."""
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(char for char in decomposed if not unicodedata.combining(char)).lower()


def list_orders(uow: UnitOfWork, store_id: str, status: str | None, search: str | None) -> list[OrderOut]:
    """Más recientes primero. La búsqueda encuentra por nombre, celular o número ("42", "#0042")."""
    wanted = (status or "").strip() or None
    if wanted is not None and wanted not in {s.value for s in OrderStatus}:
        raise ValidationFailed("El estado no es válido.", fields={"status": "Estado desconocido."})

    query = _normalize((search or "").strip())
    digits = "".join(char for char in query if char.isdigit())
    number = int(digits) if digits and query.removeprefix("#").isdigit() else None

    def matches(order: Order) -> bool:
        return (
            not query
            or query in _normalize(order.customer_name)
            or (len(digits) >= 3 and digits in order.customer_phone)
            or order.number == number
        )

    return [to_order(order) for order in repository.list_for_store(uow.session, store_id, wanted) if matches(order)]


def expire_due_orders(unit_of_work: Callable[[], Any], now: datetime | None = None) -> int:
    """
    Vence los pedidos nuevos cuya reserva ya pasó y libera su stock. Cada pedido va en su propia
    transacción: si uno falla, los demás igual se vencen, y el que falló se reintenta en la siguiente pasada.
    """
    moment = now or _now()
    with unit_of_work() as uow:
        due = repository.ids_due_to_expire(uow.session, moment)
    expired = 0
    for store_id, order_id in due:
        with unit_of_work() as uow:
            # Puede haberlo pagado o cancelado el dueño mientras tanto: se vuelve a revisar con el bloqueo puesto
            order = repository.get_for_update(uow.session, store_id, order_id)
            if order is not None and order.is_reservation_over(moment):
                order.expire(moment)
                _save(uow, order)
                expired += 1
    return expired
