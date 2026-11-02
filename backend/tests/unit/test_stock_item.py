"""Reglas de StockItem (SPEC.md, sección 7), sin base de datos."""

import pytest

from app.modules.inventory.domain.stock_item import MovementType, StockItem, StockRuleError


def item(on_hand: int = 10, reserved: int = 0, threshold: int | None = 3) -> StockItem:
    return StockItem("va_1", "st_1", on_hand=on_hand, reserved=reserved, low_stock_threshold=threshold)


def test_disponible_es_total_menos_reservado():
    assert item(10, 4).available == 6


def test_reservar_separa_sin_sacar_del_total():
    stock = item(5)
    assert stock.reserve(2) == -2
    assert (stock.on_hand, stock.reserved, stock.available) == (5, 2, 3)


def test_no_se_reserva_mas_de_lo_disponible():
    stock = item(5, 4)
    with pytest.raises(StockRuleError, match="hay 1 disponibles"):
        stock.reserve(2)
    assert (stock.on_hand, stock.reserved) == (5, 4)


def test_confirmar_pago_saca_lo_reservado_del_total():
    stock = item(5, 2)
    assert stock.commit_sale(2) == -2
    assert (stock.on_hand, stock.reserved) == (3, 0)


def test_liberar_devuelve_lo_reservado():
    stock = item(5, 2)
    assert stock.release(2) == 2
    assert (stock.on_hand, stock.reserved) == (5, 0)
    with pytest.raises(StockRuleError):
        stock.release(1)


def test_entrada_salida_y_correccion():
    stock = item(10, 1)
    assert stock.restock(12) == 12
    assert stock.remove(3) == -3
    assert stock.on_hand == 19
    assert stock.adjust(4) == -15
    assert (stock.on_hand, stock.reserved, stock.available) == (4, 1, 3)


def test_la_salida_no_toca_lo_reservado():
    stock = item(10, 1)
    with pytest.raises(StockRuleError, match="Solo puedes sacar 9"):
        stock.remove(10)


def test_corregir_nunca_por_debajo_de_lo_reservado():
    stock = item(10, 2)
    with pytest.raises(StockRuleError, match="2 unidades reservadas"):
        stock.adjust(1)
    assert stock.adjust(2) == -8


@pytest.mark.parametrize("quantity", [0, -1, 1.5, True])
def test_cantidades_invalidas(quantity):
    with pytest.raises(StockRuleError):
        item().restock(quantity)


def test_stock_bajo_segun_el_aviso():
    assert item(3).is_low
    assert not item(4).is_low
    assert not item(0, threshold=None).is_low


def test_el_historial_reconstruye_el_stock():
    """La suma de los movimientos con signo da el total y lo disponible (sin contar reservas en el total)."""
    stock = item(0, threshold=None)
    history = [
        (MovementType.IN, 10),
        (MovementType.RESERVE, 3),
        (MovementType.SALE, 2),
        (MovementType.RELEASE, 1),
        (MovementType.OUT, 1),
        (MovementType.ADJUST, 9),
    ]
    signed = [(movement, stock.apply(movement, quantity)) for movement, quantity in history]
    total_changes = sum(
        q for m, q in signed if m in (MovementType.IN, MovementType.OUT, MovementType.SALE, MovementType.ADJUST)
    )
    assert stock.on_hand == total_changes == 9
    assert stock.reserved == 0
