import os

import pytest
from fastapi.testclient import TestClient

# Las pruebas usan su propia base (yokomerce_test), nunca la de desarrollo.
# Las de tests/integration la crean si hace falta; las demás no la necesitan.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://yokomerce:yokomerce@localhost:5432/yokomerce_test"
)
os.environ["APP_ENV"] = "test"

from app.main import check_database, create_app  # noqa: E402


@pytest.fixture
def app():
    application = create_app()
    application.dependency_overrides[check_database] = lambda: True
    return application


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)
