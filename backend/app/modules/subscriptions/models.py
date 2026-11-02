"""Tabla de subscriptions: el plan de cada tienda (SPEC.md, sección 10)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base
from app.shared.models import TimestampMixin, enum_check


class SubscriptionModel(TimestampMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (CheckConstraint(enum_check("plan", ["free", "pro"]), name="plan_valid"),)

    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    plan: Mapped[str] = mapped_column(String(10), default="free")
    # null = sin vencimiento
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
