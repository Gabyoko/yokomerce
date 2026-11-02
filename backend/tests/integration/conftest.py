"""
Pruebas con base de datos: crean yokomerce_test si no existe, aplican las migraciones y cargan
los datos de prueba. Si PostgreSQL no está corriendo (docker compose up -d), se saltan.
"""

import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.shared.db import get_engine


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        exists = connection.execute(
            text("select 1 from pg_database where datname = :n"), {"n": target.database}
        ).first()
        if not exists:
            connection.execute(text(f'create database "{target.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    url = os.environ["DATABASE_URL"]
    try:
        _ensure_database(url)
    except Exception as error:  # PostgreSQL apagado o sin acceso
        pytest.skip(f"PostgreSQL no disponible para las pruebas de integración: {error}")
    command.upgrade(Config("alembic.ini"), "head")
    yield get_engine()


@pytest.fixture(scope="session")
def seeded(engine):
    from seed import seed

    seed()
    return engine
