"""Tablas de inventory: stock por variante e historial de movimientos (SPEC.md, sección 12)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base
from app.shared.models import IdColumn, enum_check

MOVEMENT_TYPES = ["reserve", "release", "sale", "in", "out", "adjust"]


class StockItemModel(Base):
    __tablename__ = "stock_items"
    __table_args__ = (
        CheckConstraint("on_hand >= 0", name="on_hand_positive"),
        CheckConstraint("reserved >= 0", name="reserved_positive"),
        CheckConstraint("reserved <= on_hand", name="reserved_within_on_hand"),
        CheckConstraint("low_stock_threshold is null or low_stock_threshold >= 0", name="threshold_positive"),
    )

    variant_id: Mapped[str] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"), primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    on_hand: Mapped[int] = mapped_column(Integer, default=0)
    reserved: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int | None] = mapped_column(Integer)
    # Bloqueo optimista para ajustes manuales (las reservas usan un UPDATE atómico)
    version: Mapped[int] = mapped_column(Integer, default=0)


class StockMovementModel(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint(enum_check("type", MOVEMENT_TYPES), name="type_valid"),
        Index("ix_stock_movements_variant_created", "variant_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    variant_id: Mapped[str] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"))
    # Sin clave foránea: ordering es dueño de los pedidos; aquí solo se guarda la referencia
    order_id: Mapped[str | None] = mapped_column(IdColumn, index=True)
    order_number: Mapped[int | None] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(10))
    # Con signo: negativo si baja lo disponible o el total, positivo si lo sube
    quantity: Mapped[int] = mapped_column(Integer)
    # "venta_tienda", "feria", "merma", "produccion", "correccion", "cancelacion"…
    reason: Mapped[str | None] = mapped_column(String(60))
    # Nombre de quien lo hizo; null = automático
    created_by: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
