"""Configuración leída del entorno y del archivo .env (ver .env.example). Nunca pongas claves en el código."""

from functools import lru_cache
from typing import Annotated, Literal, Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Emisor de los tokens de dev_token.py (solo desarrollo)
DEV_ISSUER = "yokomerce-dev"
DEV_SECRET_MIN_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"

    # postgresql+psycopg://usuario:clave@host:puerto/base
    database_url: str

    # Dominios del front que pueden llamar a la API con credenciales, separados por comas
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # Sesión real (Supabase Auth): https://<proyecto>.supabase.co/auth/v1/.well-known/jwks.json
    auth_jwks_url: str | None = None
    # https://<proyecto>.supabase.co/auth/v1
    auth_issuer: str | None = None
    auth_audience: str = "authenticated"
    # Solo desarrollo: firma los tokens de dev_token.py. Prohibido en producción
    auth_dev_secret: str | None = None

    # Dirección pública de esta API (para armar las URLs de las fotos guardadas en disco)
    public_base_url: str = "http://localhost:8000"

    # Fotos: "local" (carpeta UPLOADS_DIR, desarrollo) o "supabase" (Supabase Storage, producción)
    storage_backend: Literal["local", "supabase"] = "local"
    uploads_dir: str = "uploads"
    # Solo con STORAGE_BACKEND=supabase. La clave de servicio nunca va al front
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    supabase_bucket: str = "imagenes"

    # "false" durante la beta: todos se comportan como Pro. Debe coincidir con NEXT_PUBLIC_PLANS_ENFORCED del front
    plans_enforced: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator(
        "auth_jwks_url", "auth_issuer", "auth_dev_secret", "supabase_url", "supabase_service_key", mode="before"
    )
    @classmethod
    def empty_is_none(cls, value: object) -> object:
        return None if value == "" else value

    @model_validator(mode="after")
    def check_auth(self) -> Self:
        """Una configuración insegura impide arrancar la app, en lugar de abrir un hueco en silencio."""
        if self.auth_jwks_url and not self.auth_issuer:
            raise ValueError("AUTH_JWKS_URL necesita AUTH_ISSUER")
        if self.auth_dev_secret and len(self.auth_dev_secret) < DEV_SECRET_MIN_LENGTH:
            raise ValueError(f"AUTH_DEV_SECRET debe tener al menos {DEV_SECRET_MIN_LENGTH} caracteres")
        if self.storage_backend == "supabase" and not (self.supabase_url and self.supabase_service_key):
            raise ValueError("STORAGE_BACKEND=supabase necesita SUPABASE_URL y SUPABASE_SERVICE_KEY")
        if self.app_env == "production":
            if self.auth_dev_secret:
                raise ValueError("AUTH_DEV_SECRET no se puede usar en producción")
            if not self.auth_jwks_url:
                raise ValueError("En producción hace falta AUTH_JWKS_URL")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # database_url viene del entorno
