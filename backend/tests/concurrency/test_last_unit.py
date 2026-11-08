"""
SPEC.md, sección 13: 10 pedidos simultáneos por la última unidad, solo 1 pasa.
Cada pedido corre en su propio hilo con su propia conexión a PostgreSQL.
"""

import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.integration.conftest import engine, seeded  # noqa: F401  # fixtures con la base de pruebas
from tests.integration.test_public_api import order_body, phone

LAST_UNIT = "va_da_torta-chocolate_grande"


def test_diez_pedidos_por_la_ultima_unidad(app, seeded):  # noqa: F811
    from seed import seed

    seed()
    with seeded.connect() as connection:
        assert (
            connection.execute(
                text("select on_hand - reserved from stock_items where variant_id = :v"), {"v": LAST_UNIT}
            ).scalar_one()
            == 1
        )

    start = threading.Barrier(10)

    def buy(_: int) -> int:
        with TestClient(app) as client:
            body = order_body(
                items=[{"variantId": LAST_UNIT, "quantity": 1}], customer={"name": "Cliente", "phone": phone()}
            )
            start.wait()  # todos salen a la vez
            return client.post("/public/orders", json=body).status_code

    with ThreadPoolExecutor(max_workers=10) as pool:
        codes = sorted(pool.map(buy, range(10)))

    assert codes == [201] + [409] * 9
    with seeded.connect() as connection:
        on_hand, reserved = connection.execute(
            text("select on_hand, reserved from stock_items where variant_id = :v"), {"v": LAST_UNIT}
        ).one()
        orders = connection.execute(
            text("select count(*) from order_items where variant_id = :v and order_id ~ '^or_[0-9a-f]{32}$'"),
            {"v": LAST_UNIT},
        ).scalar_one()
    assert (on_hand, reserved) == (1, 1)
    assert orders == 1
