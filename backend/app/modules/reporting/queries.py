"""
Métricas del panel (SPEC.md, sección 12): único lugar con consultas que cruzan módulos, y solo para leer.
- Hoy y la semana se cuentan en días de Lima; la semana son los últimos 7 días incluyendo hoy.
- Pedidos de hoy: los creados hoy, sin contar cancelados ni vencidos.
- Ventas: pedidos con pago confirmado (pagado, preparando o entregado), por fecha de pago.
"""

from collections import Counter
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.catalog.public import list_products_admin
from app.modules.stores.public import Store
from app.modules.subscriptions.public import has_full_stats
from app.shared.domain.time import add_days, today_in_lima, utc_now

from .schemas import DashboardStats, TopProduct

TOP_PRODUCTS = 5
LOCAL_DAY = "(({column} at time zone 'America/Lima')::date)"


def get_dashboard_stats(session: Session, store: Store, now: datetime | None = None) -> DashboardStats:
    today = today_in_lima(now or utc_now())
    params = {"store": store.id, "today": today, "week_start": add_days(today, -6)}

    orders_today = session.execute(
        text(
            f"""
            select count(*) from orders
            where store_id = :store and {LOCAL_DAY.format(column="created_at")} = :today
              and status not in ('cancelled', 'expired')
            """
        ),
        params,
    ).scalar_one()
    pending = session.execute(
        text("select count(*) from orders where store_id = :store and status = 'new'"), params
    ).scalar_one()

    sold_filter = f"""
        o.store_id = :store and o.status in ('paid', 'preparing', 'delivered')
        and o.paid_at is not null and {LOCAL_DAY.format(column="o.paid_at")} >= :week_start
    """
    orders_week, sales = session.execute(
        text(f"select count(*), coalesce(sum(o.total_cents), 0) from orders o where {sold_filter}"), params
    ).one()
    units = Counter(
        {
            name: int(quantity)
            for name, quantity in session.execute(
                text(
                    f"""
                    select i.product_name, sum(i.quantity) from order_items i
                    join orders o on o.id = i.order_id
                    where {sold_filter}
                    group by i.product_name
                    """
                ),
                params,
            )
        }
    )

    low_stock = sum(
        1
        for product in list_products_admin(session, store)
        for variant in product.variants
        if variant.active and variant.low_stock
    )
    top = sorted(units.items(), key=lambda item: (-item[1], item[0]))[:TOP_PRODUCTS]
    if not has_full_stats(store.plan, store.plan_expires_at):
        # Plan gratis: solo lo de hoy. Lo de la semana y lo más vendido van con candado (SPEC.md, sección 10)
        sales, orders_week, top = 0, 0, []
    return DashboardStats(
        orders_today=orders_today,
        pending_confirmation=pending,
        sales_week_cents=int(sales),
        orders_week=orders_week,
        average_ticket_cents=round(int(sales) / orders_week) if orders_week else 0,
        low_stock_count=low_stock,
        top_products=[TopProduct(name=name, units=count) for name, count in top],
    )
