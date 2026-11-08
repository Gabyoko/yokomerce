"""
Verifica los tokens de sesión. El login (link al correo y Google) lo hace Supabase Auth desde el front;
este back nunca ve contraseñas: solo comprueba la firma del token con las claves públicas de Supabase.

Hay dos modos, y cada uno acepta un único tipo de firma, para que un token de un modo jamás sirva en el otro:
- Real (AUTH_JWKS_URL): firmas asimétricas ES256 o RS256, verificadas con las claves públicas del proveedor.
- Desarrollo (AUTH_DEV_SECRET, sin AUTH_JWKS_URL): HS256 con un secreto local, para probar sin cuenta de
  Supabase con `dev_token.py`. config.py lo prohíbe en producción.
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

from app.config import DEV_ISSUER, Settings, get_settings
from app.shared.errors import ServiceUnavailable, Unauthorized

INVALID_SESSION = "Tu sesión no es válida. Vuelve a ingresar."
EMAIL_MAX = 254
REQUIRED_CLAIMS = ["exp", "sub", "aud", "iss"]
ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]
# Supabase guarda sus claves públicas en caché 10 minutos: no conviene guardarlas más tiempo
JWKS_CACHE_SECONDS = 600
JWKS_TIMEOUT_SECONDS = 5


@dataclass(frozen=True)
class TokenClaims:
    subject: str
    email: str


@lru_cache
def get_jwk_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, lifespan=JWKS_CACHE_SECONDS, timeout=JWKS_TIMEOUT_SECONDS)


def _decode(token: str, settings: Settings) -> dict:
    options = {"require": REQUIRED_CLAIMS}
    if settings.auth_jwks_url:
        key = get_jwk_client(settings.auth_jwks_url).get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=ASYMMETRIC_ALGORITHMS,
            audience=settings.auth_audience,
            issuer=settings.auth_issuer,
            options=options,
        )
    if settings.auth_dev_secret:
        return jwt.decode(
            token,
            settings.auth_dev_secret,
            algorithms=["HS256"],
            audience=settings.auth_audience,
            issuer=DEV_ISSUER,
            options=options,
        )
    raise ServiceUnavailable("El inicio de sesión no está configurado.", code="auth_unavailable")


def verify_token(token: str) -> TokenClaims:
    """Devuelve quién es el usuario, o lanza Unauthorized si el token no es válido por cualquier motivo."""
    try:
        claims = _decode(token, get_settings())
    except PyJWKClientConnectionError as error:
        # El token puede ser bueno: el que falla es el proveedor. No es culpa del usuario ni debe cerrar su sesión
        raise ServiceUnavailable(
            "No pudimos revisar tu sesión. Inténtalo otra vez.", code="auth_unavailable"
        ) from error
    except PyJWTError as error:
        raise Unauthorized(INVALID_SESSION) from error

    subject, email = claims.get("sub"), claims.get("email")
    # Solo se usan estos datos del token. user_metadata no: el propio usuario puede cambiarlo.
    if (
        not isinstance(subject, str)
        or not subject
        or not isinstance(email, str)
        or not email
        or len(email) > EMAIL_MAX
        or claims.get("is_anonymous") is True
    ):
        raise Unauthorized(INVALID_SESSION)
    return TokenClaims(subject=subject, email=email.strip().lower())
