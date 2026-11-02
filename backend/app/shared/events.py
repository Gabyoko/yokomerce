"""
Bus de eventos en el mismo proceso (SPEC.md, sección 12).
Los eventos se despachan de forma síncrona, dentro de la misma transacción y antes del commit:
si un manejador falla, se deshace todo.
"""

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeVar


@dataclass(frozen=True)
class DomainEvent:
    """Base de los eventos de dominio (ej. OrderPlaced). Cada evento es un dataclass inmutable."""


E = TypeVar("E", bound=DomainEvent)

# El manejador recibe el evento y la unidad de trabajo abierta (para escribir en la misma transacción)
Handler = Callable[[Any, Any], None]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[type[DomainEvent], list[Handler]] = defaultdict(list)

    def subscribe(self, event_type: type[E], handler: Callable[[E, Any], None]) -> None:
        self._handlers[event_type].append(handler)

    def dispatch(self, event: DomainEvent, uow: Any) -> None:
        for handler in self._handlers[type(event)]:
            handler(event, uow)

    def clear(self) -> None:
        """Solo para pruebas."""
        self._handlers.clear()


# Bus único de la app: los módulos registran sus manejadores al arrancar (en main.py)
bus = EventBus()
