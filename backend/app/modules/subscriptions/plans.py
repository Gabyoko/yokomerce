"""Reglas de los planes (SPEC.md, sección 10). Los mismos límites que frontend/features/plans/lib/plans.ts."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from app.config import get_settings
from app.shared.domain.time import utc_now

GRACE_DAYS = 7

PlanId = Literal["free", "pro"]
PlanFeature = Literal["stockHistory", "fullStats", "hideBranding"]


@dataclass(frozen=True)
class Plan:
    max_products: int | None
    max_members: int
    full_stats: bool
    show_branding: bool
    stock_history: bool


PLANS: dict[str, Plan] = {
    "free": Plan(max_products=20, max_members=1, full_stats=False, show_branding=True, stock_history=False),
    "pro": Plan(max_products=None, max_members=5, full_stats=True, show_branding=False, stock_history=True),
}


def effective_plan(plan: str, expires_at: datetime | None, now: datetime | None = None) -> str:
    """Durante la beta todos son Pro. Un Pro vencido sigue 7 días y luego cuenta como gratis (no se borra nada)."""
    if not get_settings().plans_enforced:
        return "pro"
    if plan == "pro" and expires_at is not None and (now or utc_now()) > expires_at + timedelta(days=GRACE_DAYS):
        return "free"
    return plan


def plan_of(plan: str, expires_at: datetime | None, now: datetime | None = None) -> Plan:
    return PLANS[effective_plan(plan, expires_at, now)]
