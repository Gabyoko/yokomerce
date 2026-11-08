"""
Ayudas para validar los cuerpos de los endpoints del panel. Se valida a mano (no con el esquema) para
responder con las mismas claves y mensajes que espera el front: {"options.0.name": "…"}.
"""

from typing import Any, TypeGuard

from app.shared.errors import ValidationFailed


class FieldErrors:
    """Junta los errores por campo y los lanza todos juntos. El primer mensaje de cada campo es el que queda."""

    def __init__(self) -> None:
        self.fields: dict[str, str] = {}

    def add(self, field: str, message: str) -> None:
        self.fields.setdefault(field, message)

    def throw_if_any(self, message: str = "Revisa los datos.") -> None:
        if self.fields:
            raise ValidationFailed(message, fields=self.fields)


def is_object(value: Any) -> TypeGuard[dict[str, Any]]:
    return isinstance(value, dict)


def text(value: Any) -> str:
    """Texto sin espacios a los lados; "" si no es texto."""
    return value.strip() if isinstance(value, str) else ""


def is_int(value: Any, minimum: int, maximum: int) -> TypeGuard[int]:
    return isinstance(value, int) and not isinstance(value, bool) and minimum <= value <= maximum
