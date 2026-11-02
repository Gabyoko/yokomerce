"""Celulares peruanos: 9 dígitos que empiezan con 9. En WhatsApp van con el prefijo 51."""

import re
from dataclasses import dataclass

COUNTRY_CODE = "51"
_SEPARATORS = re.compile(r"[\s\-().]")


@dataclass(frozen=True)
class PhoneNumber:
    """Siempre guarda los 9 dígitos: "987654321"."""

    digits: str

    @classmethod
    def parse(cls, raw: str) -> "PhoneNumber | None":
        """Acepta lo que escribe la gente: espacios, guiones, "+51" o "51" adelante. None si no es válido."""
        digits = _SEPARATORS.sub("", raw or "")
        if digits.startswith("+"):
            digits = digits[1:]
        if not digits.isdigit():
            return None
        if len(digits) == 11 and digits.startswith(COUNTRY_CODE):
            digits = digits[len(COUNTRY_CODE) :]
        if len(digits) == 9 and digits.startswith("9"):
            return cls(digits)
        return None

    @property
    def whatsapp(self) -> str:
        """Para wa.me: "51987654321"."""
        return f"{COUNTRY_CODE}{self.digits}"

    def __str__(self) -> str:
        return f"{self.digits[:3]} {self.digits[3:6]} {self.digits[6:]}"
