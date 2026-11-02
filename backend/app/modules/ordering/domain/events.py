"""
Eventos del pedido (SPEC.md, sección 12). inventory los escucha para mover el stock:
- OrderPlaced: reserva cada ítem con stock; si falta, OutOfStock y se deshace el pedido.
- PaymentConfirmed: la reserva se convierte en venta.
- OrderCancelled: libera la reserva (si estaba nuevo) o devuelve el stock (si ya estaba pagado).
- OrderExpired: libera la reserva.
"""

from dataclasses import dataclass

from app.shared.events import DomainEvent


@dataclass(frozen=True)
class StockLine:
    variant_id: str
    quantity: int


@dataclass(frozen=True)
class OrderEvent(DomainEvent):
    order_id: str
    store_id: str
    order_number: int
    # Solo los ítems que controlan stock, agrupados por variante
    lines: tuple[StockLine, ...]


@dataclass(frozen=True)
class OrderPlaced(OrderEvent):
    pass


@dataclass(frozen=True)
class PaymentConfirmed(OrderEvent):
    pass


@dataclass(frozen=True)
class OrderCancelled(OrderEvent):
    was_paid: bool = False


@dataclass(frozen=True)
class OrderExpired(OrderEvent):
    pass
