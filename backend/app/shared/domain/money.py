"""Dinero en céntimos enteros (SPEC.md: S/ 45.00 = 4500). Nunca se usan decimales de coma flotante."""

from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class Money:
    cents: int

    def __post_init__(self) -> None:
        if not isinstance(self.cents, int) or isinstance(self.cents, bool):
            raise TypeError("Money necesita céntimos enteros")
        if self.cents < 0:
            raise ValueError("Money no puede ser negativo")

    @classmethod
    def zero(cls) -> "Money":
        return cls(0)

    def __add__(self, other: "Money") -> "Money":
        return Money(self.cents + other.cents)

    def times(self, quantity: int) -> "Money":
        return Money(self.cents * quantity)

    @staticmethod
    def sum(values: "list[Money]") -> "Money":
        return Money(sum(value.cents for value in values))

    def __str__(self) -> str:
        """4500 → "S/ 45.00", 124000 → "S/ 1,240.00"."""
        return f"S/ {self.cents // 100:,}.{self.cents % 100:02d}"
