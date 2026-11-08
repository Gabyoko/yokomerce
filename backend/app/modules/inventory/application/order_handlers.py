"""
Cómo reacciona el stock a los eventos del pedido (SPEC.md, secciones 7 y 12).
Corren dentro de la misma transacción que el pedido: si algo falla, se deshace todo.
Las variantes se recorren siempre en el mismo orden para que dos pedidos no se bloqueen entre sí.
"""

from app.modules.ordering.public import OrderCancelled, OrderEvent, OrderExpired, OrderPlaced, PaymentConfirmed
from app.shared.db import UnitOfWork
from app.shared.domain.time import utc_now
from app.shared.errors import OutOfStock
from app.shared.events import EventBus

from ..domain.stock_item import MovementType
from ..infrastructure import repository


def _now():
    return utc_now().replace(microsecond=0)


def on_order_placed(event: OrderPlaced, uow: UnitOfWork) -> None:
    """Reserva cada ítem con un UPDATE atómico. Si alguno no alcanza, OutOfStock y no se crea nada."""
    session, now = uow.session, _now()
    short: set[str] = set()
    for line in sorted(event.lines, key=lambda line: line.variant_id):
        if repository.try_reserve(session, line.variant_id, line.quantity):
            repository.record_movement(
                session,
                store_id=event.store_id,
                variant_id=line.variant_id,
                type=MovementType.RESERVE,
                quantity=-line.quantity,
                now=now,
                order_id=event.order_id,
                order_number=event.order_number,
            )
        else:
            short.add(line.variant_id)
    if short:
        # Disponibles actuales para que el carrito se ajuste (las reservas de este pedido se deshacen)
        stock = repository.stock_of(session, list(short))
        items = [
            {
                "variantId": line.variant_id,
                "available": max(stock[line.variant_id].on_hand - stock[line.variant_id].reserved, 0)
                if line.variant_id in stock
                else 0,
            }
            for line in event.lines
            if line.variant_id in short
        ]
        raise OutOfStock("Algunos productos ya no tienen stock suficiente.", ok=False, items=items)


def _apply(event: OrderEvent, uow: UnitOfWork, movement: MovementType, reason: str | None = None) -> None:
    """Cambios que no compiten con clientes: agregado StockItem con bloqueo optimista."""
    session, now = uow.session, _now()
    for line in sorted(event.lines, key=lambda line: line.variant_id):
        item = repository.find(session, line.variant_id)
        if item is None:
            # El dueño borró la variante después de venderla: no hay stock al cual devolver las unidades.
            # Una variante con unidades reservadas no se puede borrar, así que esto solo pasa en pedidos ya pagados.
            continue
        signed = item.apply(movement, line.quantity)
        repository.save(session, item)
        repository.record_movement(
            session,
            store_id=event.store_id,
            variant_id=line.variant_id,
            type=movement,
            quantity=signed,
            now=now,
            reason=reason,
            order_id=event.order_id,
            order_number=event.order_number,
            created_by=event.actor,
        )


def on_payment_confirmed(event: PaymentConfirmed, uow: UnitOfWork) -> None:
    _apply(event, uow, MovementType.SALE)


def on_order_cancelled(event: OrderCancelled, uow: UnitOfWork) -> None:
    # Nuevo: se libera lo reservado. Pagado o preparando: las unidades vuelven al total.
    _apply(event, uow, MovementType.IN if event.was_paid else MovementType.RELEASE, "cancelacion")


def on_order_expired(event: OrderExpired, uow: UnitOfWork) -> None:
    _apply(event, uow, MovementType.RELEASE)


def register(bus: EventBus) -> None:
    bus.subscribe(OrderPlaced, on_order_placed)
    bus.subscribe(PaymentConfirmed, on_payment_confirmed)
    bus.subscribe(OrderCancelled, on_order_cancelled)
    bus.subscribe(OrderExpired, on_order_expired)
