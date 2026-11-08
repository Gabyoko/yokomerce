"""Errores de concurrencia reales que se corrigieron en B5: el stock nunca debe quedar mal."""

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.modules.inventory.infrastructure import repository
from app.shared.db import unit_of_work
from app.shared.errors import Conflict
from tests.integration.conftest import engine, seeded  # noqa: F401  # fixtures con la base de pruebas
from tests.integration.test_panel import ALFAJORES, auth, new_order, stock


def test_un_ajuste_no_pisa_una_reserva_hecha_mientras_tanto(client, seeded):  # noqa: F811
    from seed import seed

    seed()
    with unit_of_work() as ajuste:
        leido = repository.load(ajuste.session, ALFAJORES)
        # Mientras tanto entra un pedido y reserva
        with unit_of_work() as pedido:
            assert repository.try_reserve(pedido.session, ALFAJORES, 2)
            pedido.session.commit()
        leido.restock(5)
        with pytest.raises(Conflict) as error:
            repository.save(ajuste.session, leido)
        assert error.value.code == "stock_changed"


def test_dos_confirmaciones_a_la_vez_descuentan_una_sola_vez(app, client, seeded):  # noqa: F811
    from seed import seed

    seed()
    start = stock(client, ALFAJORES)
    order = new_order(client)
    barrier = threading.Barrier(6)

    def confirm(_: int) -> int:
        with TestClient(app) as own:
            barrier.wait()
            return own.post(f"/me/orders/{order['id']}/confirm-payment", headers=auth()).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        codes = sorted(pool.map(confirm, range(6)))

    assert codes == [200] + [409] * 5
    assert stock(client, ALFAJORES) == (start[0] - 2, start[1])
    moves = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth()).json()
    assert sum(1 for m in moves if m["type"] == "sale" and m["orderNumber"] == order["number"]) == 1


def test_ajustes_simultaneos_no_pierden_unidades(app, client, seeded):  # noqa: F811
    """Los que chocan reciben 409 y pueden reintentar; los que pasan quedan todos sumados."""
    from seed import seed

    seed()
    start = stock(client, ALFAJORES)
    barrier = threading.Barrier(8)

    def add(_: int) -> int:
        with TestClient(app) as own:
            barrier.wait()
            return own.post(
                f"/me/variants/{ALFAJORES}/adjustments",
                json={"type": "in", "quantity": 1, "reason": "produccion"},
                headers=auth(),
            ).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = list(pool.map(add, range(8)))

    assert set(codes) <= {201, 409}
    assert stock(client, ALFAJORES)[0] == start[0] + codes.count(201)


def test_registro_doble_crea_una_sola_tienda(app, client, seeded):  # noqa: F811
    from seed import seed
    from tests.integration.test_panel import REGISTER

    seed()
    barrier = threading.Barrier(5)

    def register(i: int) -> int:
        with TestClient(app) as own:
            barrier.wait()
            body = {**REGISTER, "slug": f"tienda-doble-{i}"}
            return own.post("/me/store", json=body, headers=auth("doble")).status_code

    with ThreadPoolExecutor(max_workers=5) as pool:
        codes = sorted(pool.map(register, range(5)))
    assert codes == [201] + [409] * 4
