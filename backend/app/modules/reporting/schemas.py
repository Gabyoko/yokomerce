"""Esquemas de reporting: coinciden campo por campo con frontend/shared/types/dashboard.ts."""

from app.shared.schemas import CamelModel


class TopProduct(CamelModel):
    name: str
    units: int


class DashboardStats(CamelModel):
    orders_today: int
    pending_confirmation: int
    sales_week_cents: int
    orders_week: int
    average_ticket_cents: int
    low_stock_count: int
    top_products: list[TopProduct]
