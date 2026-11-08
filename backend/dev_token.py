"""
Crea un token de sesión para probar los endpoints /me/* sin cuenta de Supabase (solo en desarrollo).

    python -m uv run python dev_token.py dulcesdeana

Copia el resultado en /docs → botón "Authorize". Sirve con las tiendas de prueba de seed.py.
Necesita AUTH_DEV_SECRET en .env y no funciona con AUTH_JWKS_URL configurado ni en producción.
"""

import sys
from datetime import timedelta

import jwt

from app.config import DEV_ISSUER, get_settings
from app.shared.domain.time import utc_now

VALID_FOR = timedelta(hours=12)


def main() -> None:
    settings = get_settings()
    if settings.app_env == "production" or settings.auth_jwks_url or not settings.auth_dev_secret:
        sys.exit("dev_token.py solo funciona en desarrollo, con AUTH_DEV_SECRET y sin AUTH_JWKS_URL (revisa tu .env).")
    if len(sys.argv) != 2:
        sys.exit("Uso: python -m uv run python dev_token.py <slug-de-la-tienda>")
    slug = sys.argv[1]
    now = utc_now()
    print(
        jwt.encode(
            {
                "sub": f"dev|{slug}",
                "email": f"{slug}@yokomerce.test",
                "aud": settings.auth_audience,
                "iss": DEV_ISSUER,
                "iat": now,
                "exp": now + VALID_FOR,
            },
            settings.auth_dev_secret,
            algorithm="HS256",
        )
    )


if __name__ == "__main__":
    main()
