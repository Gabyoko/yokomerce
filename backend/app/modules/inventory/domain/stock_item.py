"""
Agregado StockItem: el stock de una variante (SPEC.md, sección 7). Python puro.

Garantiza 0 <= reserved <= on_hand. Cada método devuelve la cantidad con signo que se guarda
en StockMovement.quantity: negativa si baja lo disponible o el total (reserve, sale, out),
positiva si lo sube (release, in); en adjust, la diferencia entre el total nuevo y el anterior.

Las reservas al crear pedidos se hacen con un UPDATE atómico en la base (ver infraestructura);
`reserve()` existe para las pruebas y para reconstruir el stock desde el historial.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.shared.errors import Conflict


class MovementType(StrEnum):
    RESERVE = "reserve"
    RELEASE = "release"
    SALE = "sale"
    IN = "in"
    OUT = "out"
    ADJUST = "adjust"


class StockRuleError(Conflict):
    """Se rompió una regla de stock. El mensaje se muestra tal cual al dueño."""

    code = "stock_conflict"


@dataclass
class StockItem:
    variant_id: str
    store_id: str
    on_hand: int = 0
    reserved: int = 0
    low_stock_threshold: int | None = None
    # Bloqueo optimista: se guarda con WHERE version = <la leída> y aumenta en 1
    version: int = 0

    @property
    def available(self) -> int:
        return self.on_hand - self.reserved

    @property
    def is_low(self) -> bool:
        """Stock bajo: lo disponible llegó al aviso del dueño (SPEC.md: available <= lowStockThreshold)."""
        return self.low_stock_threshold is not None and self.available <= self.low_stock_threshold

    @staticmethod
    def _check_quantity(quantity: int, *, allow_zero: bool = False) -> None:
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < (0 if allow_zero else 1):
            raise StockRuleError("La cantidad no es válida.")

    def reserve(self, quantity: int) -> int:
        """Pedido nuevo: separa unidades sin sacarlas del total."""
        self._check_quantity(quantity)
        if self.available < quantity:
            raise StockRuleError(f"No alcanza el stock: hay {self.available} disponibles y se piden {quantity}.")
        self.reserved += quantity
        return -quantity

    def release(self, quantity: int) -> int:
        """Pedido nuevo cancelado o vencido: devuelve lo separado."""
        self._check_quantity(quantity)
        if self.reserved < quantity:
            raise StockRuleError(f"No se pueden liberar {quantity}: hay {self.reserved} reservados.")
        self.reserved -= quantity
        return quantity

    def commit_sale(self, quantity: int) -> int:
        """Pago confirmado: lo reservado sale del total."""
        self._check_quantity(quantity)
        if self.reserved < quantity:
            raise StockRuleError(f"No se pueden vender {quantity}: hay {self.reserved} reservados.")
        self.on_hand -= quantity
        self.reserved -= quantity
        return -quantity

    def restock(self, quantity: int) -> int:
        """Entrada: producción, compra o devolución de un pedido pagado que se canceló."""
        self._check_quantity(quantity)
        self.on_hand += quantity
        return quantity

    def remove(self, quantity: int) -> int:
        """Salida manual (venta en tienda, merma, regalo…). No puede tocar lo reservado."""
        self._check_quantity(quantity)
        if self.available < quantity:
            raise StockRuleError(
                f"Solo puedes sacar {self.available}: el resto está reservado en pedidos nuevos o no hay más."
            )
        self.on_hand -= quantity
        return -quantity

    def adjust(self, total: int) -> int:
        """Corrección: fija el total exacto. Nunca por debajo de lo reservado."""
        self._check_quantity(total, allow_zero=True)
        if total < self.reserved:
            unidades = "unidad reservada" if self.reserved == 1 else "unidades reservadas"
            raise StockRuleError(
                f"Hay {self.reserved} {unidades} en pedidos nuevos: el total no puede quedar por debajo."
            )
        difference = total - self.on_hand
        self.on_hand = total
        return difference

    def apply(self, movement: MovementType, quantity: int) -> int:
        """Aplica un movimiento por su tipo (útil para reconstruir el stock desde el historial)."""
        handlers = {
            MovementType.RESERVE: self.reserve,
            MovementType.RELEASE: self.release,
            MovementType.SALE: self.commit_sale,
            MovementType.IN: self.restock,
            MovementType.OUT: self.remove,
            MovementType.ADJUST: self.adjust,
        }
        return handlers[movement](quantity)
