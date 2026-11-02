"""Link de la tienda: yokomerce.pe/<slug>."""

import re
from dataclasses import dataclass

# SPEC.md, sección 8
RESERVED_SLUGS = frozenset(
    {"panel", "registro", "ingresar", "api", "admin", "planes", "ayuda", "terminos", "privacidad", "dev"}
)

# Minúsculas, números y guiones; de 3 a 30 caracteres; sin guion al inicio ni al final
_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$")


@dataclass(frozen=True)
class Slug:
    value: str

    @staticmethod
    def is_valid(value: str) -> bool:
        return bool(_PATTERN.match(value)) and "--" not in value and value not in RESERVED_SLUGS

    @classmethod
    def parse(cls, raw: str) -> "Slug | None":
        value = (raw or "").strip().lower()
        return cls(value) if cls.is_valid(value) else None

    def __str__(self) -> str:
        return self.value
