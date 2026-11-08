"""
Conexión a PostgreSQL y unidad de trabajo: una transacción por petición.
El caso de uso llama a `uow.commit()` al terminar: se despachan los eventos pendientes y se guarda.
Si algo falla (incluido un manejador de eventos), se deshace todo y el error llega a la respuesta.
Lo que no se confirmó al terminar la petición se descarta.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, MetaData, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings
from app.shared.events import DomainEvent, EventBus, bus

# Nombres de restricciones estables para que Alembic genere migraciones predecibles
NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base de los modelos SQLAlchemy de todos los módulos (cada módulo define sus propias tablas)."""

    metadata = MetaData(naming_convention=NAMING)


@lru_cache
def get_engine() -> Engine:
    # connect_timeout: si PostgreSQL no responde, falla rápido en vez de dejar la petición colgada
    return create_engine(get_settings().database_url, pool_pre_ping=True, connect_args={"connect_timeout": 5})


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


class UnitOfWork:
    """Transacción de una petición. Los casos de uso guardan con `session` y publican con `publish()`."""

    def __init__(self, session: Session, event_bus: EventBus = bus) -> None:
        self.session = session
        self._bus = event_bus
        self._pending: list[DomainEvent] = []

    def publish(self, *events: DomainEvent) -> None:
        self._pending.extend(events)

    def commit(self) -> None:
        # Los manejadores pueden publicar más eventos: se despachan hasta que no quede ninguno
        try:
            while self._pending:
                self._bus.dispatch(self._pending.pop(0), self)
            self.session.commit()
        except Exception:
            self.rollback()
            raise

    def rollback(self) -> None:
        self._pending.clear()
        self.session.rollback()


@contextmanager
def unit_of_work() -> Iterator[UnitOfWork]:
    """Abre una transacción; lo que no se confirmó con `commit()` se descarta al salir."""
    session = _session_factory()()
    uow = UnitOfWork(session)
    try:
        yield uow
    finally:
        uow.rollback()
        session.close()


def get_uow() -> Iterator[UnitOfWork]:
    """Dependencia de FastAPI: una unidad de trabajo por petición."""
    with unit_of_work() as uow:
        yield uow


def database_is_up() -> bool:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("select 1"))
        return True
    except Exception:
        return False
