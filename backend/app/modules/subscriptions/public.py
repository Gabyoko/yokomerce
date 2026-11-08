"""API pública de subscriptions: el plan de cada tienda (SPEC.md, sección 10)."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import SubscriptionModel
from .plans import plan_of


@dataclass(frozen=True)
class Subscription:
    plan: str
    expires_at: datetime | None


def get_subscription(session: Session, store_id: str) -> Subscription:
    row = session.scalar(select(SubscriptionModel).where(SubscriptionModel.store_id == store_id))
    if row is None:
        return Subscription(plan="free", expires_at=None)
    return Subscription(plan=row.plan, expires_at=row.expires_at)


def start_free_plan(session: Session, store_id: str) -> None:
    """Toda tienda nueva empieza en el plan gratis."""
    session.add(SubscriptionModel(store_id=store_id, plan="free", expires_at=None))
    session.flush()


def product_limit(plan: str, expires_at: datetime | None) -> int | None:
    """Máximo de productos; None = sin límite."""
    return plan_of(plan, expires_at).max_products


def has_full_stats(plan: str, expires_at: datetime | None) -> bool:
    """Métricas de la semana y lo más vendido (el plan gratis solo ve las de hoy)."""
    return plan_of(plan, expires_at).full_stats


def can_see_stock_history(plan: str, expires_at: datetime | None) -> bool:
    return plan_of(plan, expires_at).stock_history
