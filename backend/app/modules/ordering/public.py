"""API pública de ordering: lo único que otros módulos pueden usar."""

from collections.abc import Callable
from typing import Any

from .domain.events import OrderCancelled, OrderEvent, OrderExpired, OrderPlaced, PaymentConfirmed, StockLine

__all__ = [
    "OrderCancelled",
    "OrderEvent",
    "OrderExpired",
    "OrderPlaced",
    "PaymentConfirmed",
    "StockLine",
    "expire_due_orders",
]


def expire_due_orders(unit_of_work: Callable[[], Any]) -> int:
    """Vence los pedidos cuya reserva ya pasó. Devuelve cuántos."""
    # Import aquí: inventory importa este archivo para escuchar los eventos, y el caso de uso llega hasta inventory
    from .application.manage_orders import expire_due_orders as run

    return run(unit_of_work)
