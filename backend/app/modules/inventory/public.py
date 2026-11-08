"""API pública de inventory: lo único que otros módulos pueden usar."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.shared.events import EventBus

from .application import order_handlers
from .domain.stock_item import MovementType
from .infrastructure import repository


@dataclass(frozen=True)
class StockLevel:
    on_hand: int
    reserved: int
    low_stock_threshold: int | None

    @property
    def available(self) -> int:
        return self.on_hand - self.reserved


def stock_levels(session: Session, variant_ids: list[str], *, lock: bool = False) -> dict[str, StockLevel]:
    """
    Stock de varias variantes. Las que no tienen fila cuentan como 0.
    Con `lock`, nadie puede reservar esas filas hasta que termine la transacción (antes de borrar variantes).
    """
    rows = repository.stock_of(session, variant_ids, lock=lock)
    return {
        variant_id: StockLevel(row.on_hand, row.reserved, row.low_stock_threshold)
        if (row := rows.get(variant_id))
        else StockLevel(0, 0, None)
        for variant_id in variant_ids
    }


def create_stock(
    session: Session,
    *,
    store_id: str,
    variant_id: str,
    low_stock_threshold: int | None,
    initial_stock: int,
    actor: str,
    now: datetime,
) -> None:
    """Stock de una variante nueva. El stock inicial queda en el historial como un ingreso."""
    repository.create(session, store_id, variant_id, low_stock_threshold)
    if initial_stock > 0:
        item = repository.load(session, variant_id)
        signed = item.restock(initial_stock)
        repository.save(session, item)
        repository.record_movement(
            session,
            store_id=store_id,
            variant_id=variant_id,
            type=MovementType.IN,
            quantity=signed,
            now=now,
            reason="stock_inicial",
            created_by=actor,
        )


def set_low_stock_threshold(session: Session, variant_id: str, low_stock_threshold: int | None) -> None:
    repository.set_threshold(session, variant_id, low_stock_threshold)


def register_event_handlers(bus: EventBus) -> None:
    """El stock reacciona a los eventos del pedido (se llama una vez al crear la app)."""
    order_handlers.register(bus)
