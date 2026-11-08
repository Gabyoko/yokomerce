"""
Sesión y aislamiento por tienda (SPEC.md, secciones 12 y 13). Los tokens "reales" se firman aquí con una
clave propia y se verifican con el mismo flujo que los de Supabase: claves públicas (JWKS), emisor y audiencia.
"""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi.testclient import TestClient
from jwt import PyJWK, PyJWKClient
from jwt.algorithms import ECAlgorithm
from jwt.exceptions import PyJWKClientConnectionError
from pydantic import ValidationError
from sqlalchemy import text

from app.config import DEV_ISSUER, Settings, get_settings
from app.modules.iam import tokens

ISSUER = "https://proyecto.supabase.co/auth/v1"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"
KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())
KID = "clave-de-prueba"
INVALID = {"error": "unauthorized", "message": "Tu sesión no es válida. Vuelve a ingresar."}


def real_claims(**overrides) -> dict:
    now = datetime.now(UTC)
    claims = {
        "sub": "dev|dulcesdeana",
        "email": "dulcesdeana@yokomerce.test",
        "aud": "authenticated",
        "iss": ISSUER,
        "role": "authenticated",
        "is_anonymous": False,
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    claims.update(overrides)
    return {k: v for k, v in claims.items() if v is not None}


def real_token(key=KEY, kid: str = KID, algorithm: str = "ES256", **overrides) -> str:
    return jwt.encode(real_claims(**overrides), key, algorithm=algorithm, headers={"kid": kid})


def dev_token(slug: str = "dulcesdeana", **overrides) -> str:
    claims = real_claims(sub=f"dev|{slug}", email=f"{slug}@yokomerce.test", iss=DEV_ISSUER)
    claims.update(overrides)
    return jwt.encode(claims, get_settings().auth_dev_secret, algorithm="HS256")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class FakeJwksClient(PyJWKClient):
    """Cliente real de claves públicas: solo cambia de dónde las descarga."""

    def __init__(self, keys: list[dict] | None = None, down: bool = False):
        super().__init__(JWKS_URL)
        self.keys = keys
        self.down = down

    def fetch_data(self):
        if self.down:
            raise PyJWKClientConnectionError("sin conexión")
        return {"keys": self.keys}


def public_jwk(key=KEY) -> dict:
    jwk = json.loads(ECAlgorithm.to_jwk(key.public_key()))
    return {**jwk, "kid": KID, "alg": "ES256", "use": "sig"}


@pytest.fixture
def real_mode(monkeypatch):
    """La app como en producción: solo acepta tokens verificables con las claves públicas."""
    settings = Settings(auth_jwks_url=JWKS_URL, auth_issuer=ISSUER, auth_dev_secret=None)
    monkeypatch.setattr(tokens, "get_settings", lambda: settings)
    client = FakeJwksClient([public_jwk()])
    monkeypatch.setattr(tokens, "get_jwk_client", lambda url: client)
    return client


# --- Tokens rechazados ---


def test_sin_token(client, seeded):
    response = client.get("/me/store")
    assert response.status_code == 401 and response.json() == INVALID
    assert client.get("/me/store", headers={"Authorization": "Basic abc"}).json() == INVALID


def test_token_valido_del_proveedor(client, fresh, real_mode):
    response = client.get("/me/store", headers=bearer(real_token()))
    assert response.status_code == 200
    assert response.json()["slug"] == "dulcesdeana"


def expired():
    return real_token(exp=datetime.now(UTC) - timedelta(seconds=5))


def signed_with_other_key():
    return real_token(key=OTHER_KEY)


def tampered():
    header, _, signature = real_token().split(".")
    payload = jwt.utils.base64url_encode(
        json.dumps({**real_claims(sub="dev|tallernorte"), "iat": 1, "exp": 9999999999}).encode()
    )
    return f"{header}.{payload.decode()}.{signature}"


def unsigned():
    return jwt.encode(real_claims(iat=1, exp=9999999999), key="", algorithm="none", headers={"kid": KID})


def symmetric_with_public_key_as_secret():
    """Ataque clásico: firmar con HS256 usando la clave pública (que es pública) como secreto."""
    claims = real_claims(iat=1, exp=9999999999)
    header = jwt.utils.base64url_encode(json.dumps({"alg": "HS256", "kid": KID, "typ": "JWT"}).encode())
    payload = jwt.utils.base64url_encode(json.dumps(claims).encode())
    import hashlib
    import hmac

    secret = json.dumps(public_jwk()).encode()
    signature = jwt.utils.base64url_encode(hmac.new(secret, header + b"." + payload, hashlib.sha256).digest())
    return (header + b"." + payload + b"." + signature).decode()


def rsa_key_not_published():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return real_token(key=key, algorithm="RS256", kid="otra-clave")


@pytest.mark.parametrize(
    "make_token",
    [
        expired,
        signed_with_other_key,
        tampered,
        unsigned,
        symmetric_with_public_key_as_secret,
        rsa_key_not_published,
        dev_token,  # un token de desarrollo no sirve en modo real
        lambda: real_token(aud="anon"),
        lambda: real_token(iss="https://otro.supabase.co/auth/v1"),
        lambda: real_token(sub=None),
        lambda: real_token(email=None),
        lambda: real_token(email=""),
        lambda: real_token(exp=None),
        lambda: real_token(is_anonymous=True),
        lambda: "esto-no-es-un-token",
    ],
)
def test_tokens_rechazados(client, fresh, real_mode, make_token):
    response = client.get("/me/store", headers=bearer(make_token()))
    assert response.status_code == 401
    assert response.json() == INVALID


def test_token_real_no_sirve_en_modo_desarrollo(client, seeded):
    assert client.get("/me/store", headers=bearer(real_token())).status_code == 401


def test_si_el_proveedor_esta_caido_no_cierra_la_sesion(client, seeded, real_mode):
    real_mode.down = True
    response = client.get("/me/store", headers=bearer(real_token()))
    assert response.status_code == 503
    assert response.json()["error"] == "auth_unavailable"


def test_sin_configuracion_nadie_entra(client, seeded, monkeypatch):
    settings = Settings(auth_jwks_url=None, auth_issuer=None, auth_dev_secret=None)
    monkeypatch.setattr(tokens, "get_settings", lambda: settings)
    assert client.get("/me/store", headers=bearer(dev_token())).status_code == 503


@pytest.mark.parametrize(
    "values",
    [
        {"app_env": "production"},
        {"app_env": "production", "auth_dev_secret": "x" * 40, "auth_jwks_url": JWKS_URL, "auth_issuer": ISSUER},
        {"auth_jwks_url": JWKS_URL, "auth_issuer": None},
        {"auth_dev_secret": "corto"},
    ],
)
def test_configuracion_insegura_no_arranca(values):
    base = {"auth_jwks_url": None, "auth_issuer": None, "auth_dev_secret": None}
    with pytest.raises(ValidationError):
        Settings(**{**base, **values})


def test_produccion_correcta_arranca():
    settings = Settings(app_env="production", auth_jwks_url=JWKS_URL, auth_issuer=ISSUER, auth_dev_secret=None)
    assert settings.auth_audience == "authenticated"


# --- Aislamiento por tienda ---


def test_cada_duenio_ve_solo_su_tienda(client, fresh):
    for slug, store_id in [("dulcesdeana", "st_da"), ("tallernorte", "st_tn"), ("fundalab", "st_fl")]:
        body = client.get("/me/store", headers=bearer(dev_token(slug))).json()
        assert (body["slug"], body["id"]) == (slug, store_id)


def test_el_navegador_no_puede_elegir_otra_tienda(client, fresh):
    """La cabecera de la sesión simulada de la fase F no tiene ningún efecto aquí."""
    headers = {**bearer(dev_token("dulcesdeana")), "X-Mock-Store": "tallernorte", "Cookie": "mock_store=tallernorte"}
    response = client.get("/me/store", headers=headers)
    assert response.json()["slug"] == "dulcesdeana"
    assert client.get("/me/store", headers={"X-Mock-Store": "tallernorte"}).status_code == 401


def unprotected_me_routes(app, client) -> tuple[list[str], list[str]]:
    """Llama sin token a cada ruta /me/* publicada en la API. Devuelve las revisadas y las que no respondieron 401."""
    app.openapi_schema = None
    paths = client.get("/openapi.json").json()["paths"]
    checked, open_routes = [], []
    for path, methods in paths.items():
        if not path.startswith("/me"):
            continue
        url = re.sub(r"{[^}]+}", "algo", path)
        for method in methods:
            checked.append(f"{method} {path}")
            if client.request(method, url, json={}).status_code != 401:
                open_routes.append(f"{method} {path}")
    return checked, open_routes


def test_todas_las_rutas_me_exigen_sesion(app, client):
    """Si alguien agrega un endpoint /me/* sin sesión, esta prueba falla (protege también lo que venga en B5)."""
    checked, open_routes = unprotected_me_routes(app, client)
    assert "get /me/store" in checked
    assert open_routes == []


def test_el_guardian_detecta_una_ruta_sin_sesion(app, client):
    @app.get("/me/hueco")
    def hole():
        return {"secreto": True}

    assert unprotected_me_routes(app, client)[1] == ["get /me/hueco"]


# --- Primer ingreso ---


def users_with_subject(engine, subject: str) -> int:
    with engine.connect() as connection:
        return connection.execute(
            text("select count(*) from users where auth_subject = :s"), {"s": subject}
        ).scalar_one()


def test_primer_ingreso_crea_el_usuario_sin_tienda(client, fresh):
    token = dev_token("persona-nueva")
    response = client.get("/me/store", headers=bearer(token))
    assert response.status_code == 404
    assert response.json() == {"error": "no_store", "message": "Todavía no tienes una tienda."}
    assert users_with_subject(fresh, "dev|persona-nueva") == 1
    client.get("/me/store", headers=bearer(token))
    assert users_with_subject(fresh, "dev|persona-nueva") == 1


def test_primer_ingreso_simultaneo_crea_un_solo_usuario(app, fresh):
    token = dev_token("persona-apurada")

    def login(_: int) -> int:
        with TestClient(app) as client:
            return client.get("/me/store", headers=bearer(token)).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert set(pool.map(login, range(8))) == {404}
    assert users_with_subject(fresh, "dev|persona-apurada") == 1


def test_el_correo_no_da_acceso_a_una_cuenta_ajena(client, fresh):
    """Otra persona (otro `sub`) con el correo de la dueña NO entra a su tienda."""
    token = dev_token("impostor", email="dulcesdeana@yokomerce.test")
    response = client.get("/me/store", headers=bearer(token))
    assert response.status_code == 409
    assert response.json()["error"] == "email_in_use"
    assert users_with_subject(fresh, "dev|impostor") == 0


def test_tienda_desactivada_no_se_puede_usar(client, fresh):
    with fresh.begin() as connection:
        connection.execute(text("update stores set active = false where slug = 'fundalab'"))
    assert client.get("/me/store", headers=bearer(dev_token("fundalab"))).status_code == 404
    assert client.get("/public/stores/fundalab").status_code == 404


def test_miembro_invitado_entra_a_la_tienda(client, fresh):
    with fresh.begin() as connection:
        connection.execute(
            text(
                "insert into users (id, auth_subject, email, name) "
                "values ('us_m', 'dev|miembro', 'miembro@yokomerce.test', 'Miembro')"
            )
        )
        connection.execute(
            text("insert into store_members (store_id, user_id, role) values ('st_tn', 'us_m', 'member')")
        )
    assert client.get("/me/store", headers=bearer(dev_token("miembro"))).json()["slug"] == "tallernorte"


def test_openapi_documenta_la_sesion(client):
    spec = client.get("/openapi.json").json()
    assert "HTTPBearer" in spec["components"]["securitySchemes"]
    assert spec["paths"]["/me/store"]["get"]["security"] == [{"HTTPBearer": []}]


def test_jwk_de_prueba_es_valido():
    assert PyJWK.from_dict(public_jwk()).algorithm_name == "ES256"
