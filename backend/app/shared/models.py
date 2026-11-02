"""Piezas comunes de los modelos SQLAlchemy de todos los módulos."""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

# Ids de texto con prefijo ("pr_…", "or_…"): caben en 64 caracteres
IdColumn = String(64)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def enum_check(column: str, values: list[str]) -> str:
    """Texto de un CHECK que limita una columna a ciertos valores."""
    options = ", ".join(f"'{value}'" for value in values)
    return f"{column} in ({options})"
