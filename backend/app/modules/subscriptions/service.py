"""Lógica de subscriptions (módulo simple): cambiar el plan de una tienda."""

from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .models import SubscriptionModel


def set_plan(session: Session, store_id: str, plan: str, expires_at: datetime | None) -> None:
    """Crea o reemplaza la suscripción de la tienda."""
    if plan not in ("free", "pro"):
        raise ValueError(f"Plan desconocido: {plan}")
    session.execute(
        insert(SubscriptionModel)
        .values(store_id=store_id, plan=plan, expires_at=expires_at)
        .on_conflict_do_update(index_elements=["store_id"], set_={"plan": plan, "expires_at": expires_at})
    )
