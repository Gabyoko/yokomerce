"""
Guarda el contrato de la API (OpenAPI) en openapi.json, sin tener que levantar el servidor.
El front genera sus tipos desde aquí para compararlos con frontend/shared/types (SPEC.md, etapa C1).

    python -m uv run python export_openapi.py
"""

import json
import os
from pathlib import Path

# Solo se lee la definición de la API: no hace falta base de datos ni sesión real
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://x:x@localhost:5432/x")
os.environ.setdefault("APP_ENV", "test")

from app.main import create_app  # noqa: E402

TARGET = Path(__file__).with_name("openapi.json")

if __name__ == "__main__":
    schema = create_app().openapi()
    TARGET.write_text(json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Listo: {TARGET.name} ({len(schema['paths'])} rutas, {len(schema['components']['schemas'])} esquemas)")
