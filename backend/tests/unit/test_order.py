"""Reglas del agregado Order (SPEC.md, sección 7), sin base de datos."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.modules.ordering.domain.events import OrderCancelled, OrderExpired, OrderPlaced, PaymentConfirmed, StockLine
from app.modules.ordering.domain.order import (
    Fulfillment,
    FulfillmentType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
)
from app.shared.domain.money import Money
from app.shared.errors import InvalidTransition

NOW = datetime(2026, 10, 29, 15, 28, tzinfo=UTC)


def new_order(**overrides) -> Order:
    fields = dict(
        id="or_1",
        store_id="st_1",
        number=42,
        public_token="abc",
        customer_name="María López",
        customer_phone="987654321",
        fulfillment=Fulfillment(
            FulfillmentType.DELIVERY, zone_id="zn_1", zone_name="Santiago de Surco", address="Av. Primavera 123"
        ),
        delivery_date=date(2026, 10, 31),
        payment_method=PaymentMethod.YAPE,
        items=[
            OrderItem("va_torta", "Torta de chocolate", "Mediana", Money(4500), 2, {"Dedicatoria": "Feliz día"}, True),
            OrderItem("va_alfajor", "Alfajores x12", "", Money(1800), 1, {}, True),
            OrderItem("va_torta", "Torta de chocolate", "Mediana", Money(4500), 1, {"Dedicatoria": "Otra"}, True),
            OrderItem("va_tres", "Torta tres leches", "", Money(5000), 1, {}, False),
        ],
        delivery_fee=Money(800),
        reserved_until=NOW + timedelta(hours=24),
        created_at=NOW,
    )
    fields.update(overrides)
    return Order.place(**fields)


def test_totales_desde_los_items():
    order = new_order()
    assert order.subtotal == Money(4500 * 3 + 1800 + 5000)
    assert order.total == Money(4500 * 3 + 1800 + 5000 + 800)


def test_envio_a_coordinar_no_suma_al_total():
    order = new_order(delivery_fee=None)
    assert order.total == order.subtotal


def test_crear_registra_order_placed_solo_con_lo_que_controla_stock():
    order = new_order()
    assert order.status == OrderStatus.NEW
    [event] = order.pull_events()
    assert isinstance(event, OrderPlaced)
    # La torta viene en dos líneas: se agrupa; la tres leches es por encargo y no reserva
    assert event.lines == (StockLine("va_torta", 3), StockLine("va_alfajor", 1))
    assert order.pull_events() == []


def test_recorrido_completo():
    order = new_order()
    order.pull_events()
    order.confirm_payment(NOW + timedelta(minutes=30))
    assert order.status == OrderStatus.PAID and order.paid_at is not None
    assert isinstance(order.pull_events()[0], PaymentConfirmed)
    order.start_preparing()
    order.deliver(NOW + timedelta(days=2))
    assert order.status == OrderStatus.DELIVERED and order.delivered_at is not None
    assert order.pull_events() == []


@pytest.mark.parametrize(
    ("path", "bad"),
    [
        ([], "start_preparing"),
        ([], "deliver"),
        (["confirm_payment"], "confirm_payment"),
        (["confirm_payment", "start_preparing", "deliver"], "cancel"),
        (["cancel"], "confirm_payment"),
    ],
)
def test_transiciones_no_permitidas(path, bad):
    order = new_order()
    for step in path:
        getattr(order, step)(NOW) if step != "start_preparing" else order.start_preparing()
    with pytest.raises(InvalidTransition):
        getattr(order, bad)(NOW) if bad != "start_preparing" else order.start_preparing()


def test_mensaje_de_transicion():
    order = new_order()
    order.cancel(NOW)
    with pytest.raises(InvalidTransition, match="está cancelado y no se puede pasar a pagado"):
        order.confirm_payment(NOW)


def test_cancelar_nuevo_libera_y_cancelar_pagado_devuelve():
    nuevo = new_order()
    nuevo.pull_events()
    nuevo.cancel(NOW)
    [event] = nuevo.pull_events()
    assert isinstance(event, OrderCancelled) and event.was_paid is False

    pagado = new_order()
    pagado.confirm_payment(NOW)
    pagado.start_preparing()
    pagado.pull_events()
    pagado.cancel(NOW)
    [event] = pagado.pull_events()
    assert event.was_paid is True


def test_vencer_solo_si_paso_la_reserva():
    order = new_order()
    order.pull_events()
    with pytest.raises(InvalidTransition):
        order.expire(NOW + timedelta(hours=1))
    assert order.is_reservation_over(NOW + timedelta(hours=24))
    order.expire(NOW + timedelta(hours=24))
    assert order.status == OrderStatus.EXPIRED
    assert isinstance(order.pull_events()[0], OrderExpired)


def test_un_pedido_necesita_items():
    with pytest.raises(ValueError):
        new_order(items=[])
