"""Tablas de ordering: pedidos e ítems (copia de lo pedido al momento del pedido)."""

from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base
from app.shared.models import IdColumn, TimestampMixin, enum_check

STATUSES = ["new", "paid", "preparing", "delivered", "cancelled", "expired"]
FULFILLMENT_TYPES = ["delivery", "pickup", "shipping"]
PAYMENT_METHODS = ["yape", "plin", "cash", "transfer"]


class OrderModel(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("store_id", "number", name="uq_orders_store_number"),
        CheckConstraint(enum_check("status", STATUSES), name="status_valid"),
        CheckConstraint(enum_check("fulfillment_type", FULFILLMENT_TYPES), name="fulfillment_type_valid"),
        CheckConstraint(enum_check("payment_method", PAYMENT_METHODS), name="payment_method_valid"),
        CheckConstraint("subtotal_cents >= 0 and total_cents >= 0", name="totals_positive"),
        # Para vencer reservas y listar el panel por estado
        Index("ix_orders_store_status", "store_id", "status"),
        Index("ix_orders_status_reserved_until", "status", "reserved_until"),
        Index("ix_orders_customer_phone_created", "customer_phone", "created_at"),
    )

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    public_token: Mapped[str] = mapped_column(String(40), unique=True)
    status: Mapped[str] = mapped_column(String(12), default="new")
    customer_name: Mapped[str] = mapped_column(String(60))
    # 9 dígitos: "987654321"
    customer_phone: Mapped[str] = mapped_column(String(9))
    fulfillment_type: Mapped[str] = mapped_column(String(10))
    # Sin clave foránea: si la zona se borra, el pedido guarda su nombre
    delivery_zone_id: Mapped[str | None] = mapped_column(IdColumn)
    zone_name: Mapped[str | None] = mapped_column(String(60))
    city: Mapped[str | None] = mapped_column(String(60))
    address: Mapped[str | None] = mapped_column(String(200))
    reference: Mapped[str | None] = mapped_column(String(200))
    delivery_date: Mapped[date | None] = mapped_column(Date)
    payment_method: Mapped[str] = mapped_column(String(10))
    subtotal_cents: Mapped[int] = mapped_column(Integer)
    # null = envío "a coordinar"
    delivery_fee_cents: Mapped[int | None] = mapped_column(Integer)
    total_cents: Mapped[int] = mapped_column(Integer)
    reserved_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Nota interna del negocio (el cliente no la ve)
    notes: Mapped[str | None] = mapped_column(Text)


class OrderItemModel(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity between 1 and 99", name="quantity_range"),)

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    # Sin clave foránea: la variante puede borrarse; el ítem guarda la copia
    variant_id: Mapped[str] = mapped_column(IdColumn)
    product_name: Mapped[str] = mapped_column(String(80))
    variant_label: Mapped[str] = mapped_column(String(100), default="")
    unit_price_cents: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)
    line_total_cents: Mapped[int] = mapped_column(Integer)
    # {"Dedicatoria": "Feliz cumpleaños, Lucía"}
    custom_values: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict)
    tracks_stock: Mapped[bool] = mapped_column(default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
