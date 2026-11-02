"""
Conexión a PostgreSQL y unidad de trabajo: una transacción por petición.
Al terminar la petición sin errores se despachan los eventos pendientes y se hace commit;
si algo falla (incluido un manejador de eventos), se deshace todo.
"""

from collections.abc import Iterator
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
    return create_engine(get_settings().database_url, pool_pre_ping=True)


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
        while self._pending:
            self._bus.dispatch(self._pending.pop(0), self)
        self.session.commit()

    def rollback(self) -> None:
        self._pending.clear()
        self.session.rollback()


def get_uow() -> Iterator[UnitOfWork]:
    """Dependencia de FastAPI: abre la transacción y la cierra al terminar la petición."""
    session = _session_factory()()
    uow = UnitOfWork(session)
    try:
        yield uow
        uow.commit()
    except Exception:
        uow.rollback()
        raise
    finally:
        session.close()


def database_is_up() -> bool:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("select 1"))
        return True
    except Exception:
        return False
