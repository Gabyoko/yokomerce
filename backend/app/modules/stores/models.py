"""Tablas de stores: tienda, zonas de delivery y miembros (SPEC.md, secciones 4 y 12)."""

from typing import Any

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base
from app.shared.models import IdColumn, TimestampMixin, enum_check


class StoreModel(TimestampMixin, Base):
    __tablename__ = "stores"
    __table_args__ = (
        CheckConstraint("next_order_number >= 1", name="next_order_number_positive"),
        CheckConstraint("reservation_hours between 1 and 168", name="reservation_hours_range"),
        CheckConstraint("shipping_fee_cents is null or shipping_fee_cents >= 0", name="shipping_fee_positive"),
    )

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    slug: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text, default="")
    logo_url: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(60))
    # "51912345678"
    whatsapp: Mapped[str] = mapped_column(String(11))
    # {"mon": {"open": "09:00", "close": "20:00"}, ..., "sun": null}
    business_hours: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # ["yape", "plin", ...]
    payment_methods: Mapped[list[str]] = mapped_column(JSONB)
    payment_instructions: Mapped[str | None] = mapped_column(Text)
    # StoreFeatures: {"deliveryDate": true, "leadTimeDays": 1, ...} (mismas claves que el contrato)
    features: Mapped[dict[str, Any]] = mapped_column(JSONB)
    pickup_address: Mapped[str | None] = mapped_column(String(200))
    # null = envío "a coordinar"
    shipping_fee_cents: Mapped[int | None] = mapped_column(Integer)
    reservation_hours: Mapped[int] = mapped_column(Integer, default=24)
    next_order_number: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class DeliveryZoneModel(Base):
    __tablename__ = "delivery_zones"
    __table_args__ = (CheckConstraint("price_cents >= 0", name="price_positive"),)

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    price_cents: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class StoreMemberModel(TimestampMixin, Base):
    __tablename__ = "store_members"
    __table_args__ = (
        CheckConstraint(enum_check("role", ["owner", "member"]), name="role_valid"),
        Index("ix_store_members_user_id", "user_id"),
    )

    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(10), default="owner")
