"""
Acceso a stock_items y stock_movements.

- Reservas: UPDATE atómico (WHERE on_hand - reserved >= q). Nunca leer y luego escribir en dos pasos:
  es el punto donde más clientes compiten a la vez (SPEC.md, "Concurrencia en el stock").
- Los demás cambios: se carga el agregado StockItem, se aplica su método y se guarda con bloqueo
  optimista (WHERE version = la leída). Si otro cambió el stock al mismo tiempo, 409.
- Toda escritura aumenta `version`, incluida la reserva: si no, un ajuste que leyó antes de la reserva
  la pisaría al guardar y las unidades reservadas se perderían.
"""

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.shared.domain.ids import new_id
from app.shared.errors import Conflict, NotFound

from ..domain.stock_item import MovementType, StockItem
from .models import StockItemModel, StockMovementModel


def stock_of(session: Session, variant_ids: list[str], *, lock: bool = False) -> dict[str, StockItemModel]:
    if not variant_ids:
        return {}
    # populate_existing: los UPDATE directos no refrescan lo que la sesión ya tenía en memoria
    query = select(StockItemModel).where(StockItemModel.variant_id.in_(variant_ids))
    if lock:
        query = query.order_by(StockItemModel.variant_id).with_for_update()
    rows = session.scalars(query.execution_options(populate_existing=True))
    return {row.variant_id: row for row in rows}


def try_reserve(session: Session, variant_id: str, quantity: int) -> bool:
    """Reserva solo si alcanza. Devuelve False si no se actualizó ninguna fila (no hay stock suficiente)."""
    result = session.execute(
        update(StockItemModel)
        .where(StockItemModel.variant_id == variant_id, StockItemModel.on_hand - StockItemModel.reserved >= quantity)
        .values(reserved=StockItemModel.reserved + quantity, version=StockItemModel.version + 1)
        .returning(StockItemModel.variant_id)
    )
    return result.first() is not None


def find(session: Session, variant_id: str) -> StockItem | None:
    row = stock_of(session, [variant_id]).get(variant_id)
    if row is None:
        return None
    return StockItem(
        variant_id=row.variant_id,
        store_id=row.store_id,
        on_hand=row.on_hand,
        reserved=row.reserved,
        low_stock_threshold=row.low_stock_threshold,
        version=row.version,
    )


def load(session: Session, variant_id: str) -> StockItem:
    item = find(session, variant_id)
    if item is None:
        raise NotFound("No encontramos el stock de esta variante.")
    return item


def save(session: Session, item: StockItem) -> None:
    """Guarda con bloqueo optimista: falla si alguien cambió el stock desde que se leyó."""
    result = session.execute(
        update(StockItemModel)
        .where(StockItemModel.variant_id == item.variant_id, StockItemModel.version == item.version)
        .values(on_hand=item.on_hand, reserved=item.reserved, version=item.version + 1)
        .returning(StockItemModel.variant_id)
    )
    if result.first() is None:
        raise Conflict("El stock cambió mientras lo editabas. Vuelve a intentarlo.", code="stock_changed")
    item.version += 1


def create(session: Session, store_id: str, variant_id: str, low_stock_threshold: int | None) -> None:
    session.add(
        StockItemModel(
            variant_id=variant_id,
            store_id=store_id,
            on_hand=0,
            reserved=0,
            low_stock_threshold=low_stock_threshold,
            version=0,
        )
    )
    session.flush()


def set_threshold(session: Session, variant_id: str, low_stock_threshold: int | None) -> None:
    session.execute(
        update(StockItemModel)
        .where(StockItemModel.variant_id == variant_id)
        .values(low_stock_threshold=low_stock_threshold)
    )


def record_movement(
    session: Session,
    *,
    store_id: str,
    variant_id: str,
    type: MovementType,
    quantity: int,
    now: datetime,
    reason: str | None = None,
    order_id: str | None = None,
    order_number: int | None = None,
    created_by: str | None = None,
) -> StockMovementModel:
    movement = StockMovementModel(
        id=new_id("mv"),
        store_id=store_id,
        variant_id=variant_id,
        order_id=order_id,
        order_number=order_number,
        type=type.value,
        quantity=quantity,
        reason=reason,
        created_by=created_by,
        created_at=now,
    )
    session.add(movement)
    session.flush()
    return movement


def movements_of(session: Session, variant_id: str) -> list[StockMovementModel]:
    """Más recientes primero."""
    return list(
        session.scalars(
            select(StockMovementModel)
            .where(StockMovementModel.variant_id == variant_id)
            .order_by(StockMovementModel.seq.desc())
        )
    )
