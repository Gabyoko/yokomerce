"""
Fotos de productos, logos y portadas (SPEC.md, sección 12): solo JPG, PNG y WebP, máximo 5 MB, guardadas
en una carpeta por tienda (`stores/<id_de_tienda>/…`) y solo las puede subir un miembro de esa tienda.

El tipo se reconoce por los primeros bytes del archivo, no por lo que diga el navegador: así no se puede
subir, por ejemplo, un SVG o un HTML disfrazado de foto.

Dónde se guardan (STORAGE_BACKEND en .env):
- "local": en la carpeta UPLOADS_DIR y la API las sirve en /uploads. Para desarrollo o un servidor con disco propio.
- "supabase": en un bucket público de Supabase Storage. Para producción.
"""

import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Protocol

import httpx

from app.config import Settings, get_settings
from app.shared.errors import ServiceUnavailable, ValidationFailed

MAX_BYTES = 5 * 1024 * 1024
UPLOADS_ROUTE = "/uploads"


@dataclass(frozen=True)
class ImageKind:
    extension: str
    content_type: str


def detect_image(head: bytes) -> ImageKind | None:
    """Reconoce JPG, PNG y WebP por su firma. Cualquier otra cosa devuelve None."""
    if head.startswith(b"\xff\xd8\xff"):
        return ImageKind("jpg", "image/jpeg")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ImageKind("png", "image/png")
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ImageKind("webp", "image/webp")
    return None


def read_image(file: BinaryIO) -> tuple[bytes, ImageKind]:
    """Lee el archivo sin pasarse de 5 MB y comprueba que sea una foto permitida."""
    data = file.read(MAX_BYTES + 1)
    if not data:
        raise ValidationFailed("Adjunta una imagen.", fields={"file": "Adjunta una imagen."})
    if len(data) > MAX_BYTES:
        raise ValidationFailed("La imagen pesa más de 5 MB.", fields={"file": "Máximo 5 MB."})
    kind = detect_image(data[:16])
    if kind is None:
        raise ValidationFailed("Usa una foto JPG, PNG o WebP.", fields={"file": "Debe ser una foto JPG, PNG o WebP."})
    return data, kind


class ImageStorage(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> str:
        """Guarda el archivo y devuelve su URL pública."""
        ...


class LocalStorage:
    def __init__(self, directory: Path, public_base_url: str) -> None:
        self.directory = directory
        self.public_base_url = public_base_url.rstrip("/")

    def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self.directory / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.public_base_url}{UPLOADS_ROUTE}/{key}"


class SupabaseStorage:
    """API de Supabase Storage. Usa la clave de servicio, que vive solo en el servidor (nunca en el front)."""

    def __init__(self, url: str, service_key: str, bucket: str, client: httpx.Client | None = None) -> None:
        self.url = url.rstrip("/")
        self.bucket = bucket
        self.service_key = service_key
        self.client = client or httpx.Client(timeout=15)

    def save(self, key: str, data: bytes, content_type: str) -> str:
        try:
            response = self.client.post(
                f"{self.url}/storage/v1/object/{self.bucket}/{key}",
                content=data,
                headers={
                    "Authorization": f"Bearer {self.service_key}",
                    "apikey": self.service_key,
                    "Content-Type": content_type,
                    "Cache-Control": "max-age=31536000",
                    # Cada foto tiene un nombre nuevo: nunca se reemplaza una existente
                    "x-upsert": "false",
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise ServiceUnavailable(
                "No pudimos guardar la imagen. Inténtalo otra vez.", code="storage_unavailable"
            ) from error
        return f"{self.url}/storage/v1/object/public/{self.bucket}/{key}"


def get_storage(settings: Settings | None = None) -> ImageStorage:
    settings = settings or get_settings()
    if settings.storage_backend == "supabase":
        return SupabaseStorage(settings.supabase_url, settings.supabase_service_key, settings.supabase_bucket)  # type: ignore[arg-type]
    return LocalStorage(Path(settings.uploads_dir), settings.public_base_url)


def save_image(storage: ImageStorage, store_id: str, file: BinaryIO) -> str:
    """Valida y guarda la foto en la carpeta de la tienda. Devuelve su URL pública."""
    data, kind = read_image(file)
    # Nombre al azar: nadie puede adivinar ni pisar fotos ajenas
    key = f"stores/{store_id}/{uuid.uuid4().hex}.{kind.extension}"
    return storage.save(key, data, kind.content_type)
