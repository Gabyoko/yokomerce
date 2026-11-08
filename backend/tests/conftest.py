import os
import tempfile

import pytest
from fastapi.testclient import TestClient

# Las pruebas usan su propia base (yokomerce_test), nunca la de desarrollo.
# Las de tests/integration la crean si hace falta; las demás no la necesitan.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://yokomerce:yokomerce@localhost:5432/yokomerce_test"
)
os.environ["APP_ENV"] = "test"
# Sesión de las pruebas: modo desarrollo con un secreto propio, sin importar lo que diga tu .env
os.environ["AUTH_JWKS_URL"] = ""
os.environ["AUTH_ISSUER"] = ""
os.environ["AUTH_DEV_SECRET"] = "secreto-solo-para-las-pruebas-automaticas"
# Las fotos de las pruebas van a una carpeta temporal, nunca a la de desarrollo
os.environ["STORAGE_BACKEND"] = "local"
os.environ["UPLOADS_DIR"] = os.path.join(tempfile.gettempdir(), "yokomerce-pruebas-uploads")

from app.main import check_database, create_app  # noqa: E402


@pytest.fixture
def app():
    application = create_app()
    application.dependency_overrides[check_database] = lambda: True
    return application


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)
