"""La unidad de trabajo despacha los eventos antes del commit y deshace todo si un manejador falla."""

from dataclasses import dataclass

import pytest

from app.shared.db import UnitOfWork
from app.shared.events import DomainEvent, EventBus


@dataclass(frozen=True)
class OrderPlaced(DomainEvent):
    order_id: str


@dataclass(frozen=True)
class StockReserved(DomainEvent):
    order_id: str


class FakeSession:
    def __init__(self):
        self.log: list[str] = []

    def commit(self):
        self.log.append("commit")

    def rollback(self):
        self.log.append("rollback")


def test_despacha_en_orden_y_luego_hace_commit():
    bus, session = EventBus(), FakeSession()

    def reserve(event, uow):
        session.log.append(f"reserva {event.order_id}")
        uow.publish(StockReserved(event.order_id))

    bus.subscribe(OrderPlaced, reserve)
    bus.subscribe(StockReserved, lambda event, uow: session.log.append(f"reservado {event.order_id}"))
    uow = UnitOfWork(session, bus)  # type: ignore[arg-type]
    uow.publish(OrderPlaced("or_1"))
    uow.commit()
    assert session.log == ["reserva or_1", "reservado or_1", "commit"]


def test_si_un_manejador_falla_no_hay_commit():
    bus, session = EventBus(), FakeSession()

    def fail(event, uow):
        raise RuntimeError("sin stock")

    bus.subscribe(OrderPlaced, fail)
    uow = UnitOfWork(session, bus)  # type: ignore[arg-type]
    uow.publish(OrderPlaced("or_1"))
    with pytest.raises(RuntimeError):
        uow.commit()
    # commit() deshace todo por su cuenta cuando un manejador falla
    assert session.log == ["rollback"]
