"""La base de datos y los datos de prueba cumplen las reglas de SPEC.md (secciones 6, 7 y 12)."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


def scalar(engine, sql: str, **params):
    with engine.connect() as connection:
        return connection.execute(text(sql), params).scalar_one()


def test_tres_tiendas_con_sus_datos(seeded):
    rows = {
        slug: (products, orders)
        for slug, products, orders in seeded.connect().execute(
            text(
                "select s.slug,"
                " (select count(*) from products p where p.store_id = s.id),"
                " (select count(*) from orders o where o.store_id = s.id)"
                " from stores s"
            )
        )
    }
    assert rows == {"dulcesdeana": (7, 11), "tallernorte": (6, 9), "fundalab": (7, 8)}


def test_el_historial_suma_lo_mismo_que_el_stock(seeded):
    """SPEC.md, sección 13: el historial de movimientos permite reconstruir el stock."""
    mismatches = scalar(
        seeded,
        """
        select count(*) from stock_items s
        left join lateral (
            select
                coalesce(sum(quantity) filter (where type in ('in', 'out', 'sale', 'adjust')), 0) as on_hand,
                coalesce(sum(-quantity) filter (where type = 'reserve'), 0)
                  - coalesce(sum(quantity) filter (where type = 'release'), 0)
                  + coalesce(sum(quantity) filter (where type = 'sale'), 0) as reserved
            from stock_movements m where m.variant_id = s.variant_id
        ) h on true
        where h.on_hand <> s.on_hand or h.reserved <> s.reserved
        """,
    )
    assert mismatches == 0


def test_los_pedidos_nuevos_tienen_su_stock_reservado(seeded):
    """Lo reservado en stock_items es la suma de los ítems con stock de los pedidos nuevos."""
    mismatches = scalar(
        seeded,
        """
        select count(*) from stock_items s
        where s.reserved <> coalesce((
            select sum(i.quantity) from order_items i join orders o on o.id = i.order_id
            where i.variant_id = s.variant_id and i.tracks_stock and o.status = 'new'
        ), 0)
        """,
    )
    assert mismatches == 0


def test_totales_de_los_pedidos(seeded):
    wrong = scalar(
        seeded,
        """
        select count(*) from orders o
        where o.subtotal_cents <> (select sum(line_total_cents) from order_items i where i.order_id = o.id)
           or o.total_cents <> o.subtotal_cents + coalesce(o.delivery_fee_cents, 0)
        """,
    )
    assert wrong == 0


ANY_VARIANT = "(select variant_id from stock_items where on_hand > 0 limit 1)"


@pytest.mark.parametrize(
    "sql",
    [
        f"update stock_items set reserved = on_hand + 1 where variant_id = {ANY_VARIANT}",
        f"update stock_items set on_hand = -1 where variant_id = {ANY_VARIANT}",
        "update orders set status = 'perdido' where id = 'or_da_32'",
        "update orders set number = 33 where id = 'or_da_32'",
        "update stores set slug = 'tallernorte' where slug = 'dulcesdeana'",
    ],
)
def test_la_base_rechaza_datos_imposibles(seeded, sql):
    with pytest.raises(IntegrityError), seeded.begin() as connection:
        connection.execute(text(sql))
