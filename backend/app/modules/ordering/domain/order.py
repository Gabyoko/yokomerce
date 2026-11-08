"""
Agregado Order (SPEC.md, sección 7). Python puro.

Estados: new → paid → preparing → delivered. Además cancelled (desde new, paid o preparing)
y expired (automático desde new cuando pasa reserved_until). Cualquier otra transición lanza
InvalidTransition (409). Cada cambio registra un evento que inventory usa para mover el stock.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum

from app.shared.domain.money import Money
from app.shared.errors import InvalidTransition

from .events import OrderCancelled, OrderExpired, OrderPlaced, PaymentConfirmed, StockLine


class OrderStatus(StrEnum):
    NEW = "new"
    PAID = "paid"
    PREPARING = "preparing"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


STATUS_LABELS = {
    OrderStatus.NEW: "nuevo",
    OrderStatus.PAID: "pagado",
    OrderStatus.PREPARING: "preparando",
    OrderStatus.DELIVERED: "entregado",
    OrderStatus.CANCELLED: "cancelado",
    OrderStatus.EXPIRED: "vencido",
}

TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    OrderStatus.NEW: frozenset({OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.EXPIRED}),
    OrderStatus.PAID: frozenset({OrderStatus.PREPARING, OrderStatus.CANCELLED}),
    OrderStatus.PREPARING: frozenset({OrderStatus.DELIVERED, OrderStatus.CANCELLED}),
    OrderStatus.DELIVERED: frozenset(),
    OrderStatus.CANCELLED: frozenset(),
    OrderStatus.EXPIRED: frozenset(),
}


class FulfillmentType(StrEnum):
    DELIVERY = "delivery"
    PICKUP = "pickup"
    SHIPPING = "shipping"


class PaymentMethod(StrEnum):
    YAPE = "yape"
    PLIN = "plin"
    CASH = "cash"
    TRANSFER = "transfer"


@dataclass(frozen=True)
class OrderItem:
    """Copia de la variante al momento del pedido: si el producto cambia después, el pedido no."""

    variant_id: str
    product_name: str
    variant_label: str
    unit_price: Money
    quantity: int
    custom_values: dict[str, str]
    tracks_stock: bool

    @property
    def line_total(self) -> Money:
        return self.unit_price.times(self.quantity)


@dataclass(frozen=True)
class Fulfillment:
    type: FulfillmentType
    zone_id: str | None = None
    zone_name: str | None = None
    city: str | None = None
    address: str | None = None
    reference: str | None = None


@dataclass
class Order:
    id: str
    store_id: str
    number: int
    public_token: str
    status: OrderStatus
    customer_name: str
    customer_phone: str
    fulfillment: Fulfillment
    delivery_date: date | None
    payment_method: PaymentMethod
    items: list[OrderItem]
    # None = envío "a coordinar"
    delivery_fee: Money | None
    reserved_until: datetime
    created_at: datetime
    paid_at: datetime | None = None
    delivered_at: datetime | None = None
    cancelled_at: datetime | None = None
    notes: str | None = None
    _events: list[object] = field(default_factory=list, repr=False, compare=False)

    # --- Totales (siempre desde los ítems guardados, nunca desde lo que manda el navegador) ---

    @property
    def subtotal(self) -> Money:
        return Money.sum([item.line_total for item in self.items])

    @property
    def total(self) -> Money:
        return self.subtotal + (self.delivery_fee or Money.zero())

    @property
    def stock_lines(self) -> tuple[StockLine, ...]:
        """Unidades por variante de los ítems que controlan stock (una variante puede venir en varias líneas)."""
        totals: dict[str, int] = {}
        for item in self.items:
            if item.tracks_stock:
                totals[item.variant_id] = totals.get(item.variant_id, 0) + item.quantity
        return tuple(StockLine(variant_id, quantity) for variant_id, quantity in totals.items())

    # --- Crear ---

    @classmethod
    def place(cls, **fields: object) -> "Order":
        """Crea un pedido nuevo y registra OrderPlaced (inventory reserva el stock)."""
        if not fields.get("items"):
            raise ValueError("Un pedido necesita al menos un ítem")
        order = cls(status=OrderStatus.NEW, **fields)  # type: ignore[arg-type]
        order._record(OrderPlaced(order.id, order.store_id, order.number, order.stock_lines))
        return order

    # --- Transiciones ---

    def _move_to(self, target: OrderStatus) -> OrderStatus:
        if target not in TRANSITIONS[self.status]:
            raise InvalidTransition(
                f"Este pedido está {STATUS_LABELS[self.status]} y no se puede pasar a {STATUS_LABELS[target]}."
            )
        previous = self.status
        self.status = target
        return previous

    def confirm_payment(self, now: datetime, actor: str | None = None) -> None:
        self._move_to(OrderStatus.PAID)
        self.paid_at = now
        self._record(PaymentConfirmed(self.id, self.store_id, self.number, self.stock_lines, actor))

    def start_preparing(self) -> None:
        self._move_to(OrderStatus.PREPARING)

    def deliver(self, now: datetime) -> None:
        self._move_to(OrderStatus.DELIVERED)
        self.delivered_at = now

    def cancel(self, now: datetime, actor: str | None = None) -> None:
        previous = self._move_to(OrderStatus.CANCELLED)
        self.cancelled_at = now
        # Si estaba nuevo se libera la reserva; si estaba pagado o preparando, el stock vuelve
        self._record(
            OrderCancelled(
                self.id, self.store_id, self.number, self.stock_lines, actor, was_paid=previous != OrderStatus.NEW
            )
        )

    def is_reservation_over(self, now: datetime) -> bool:
        return self.status == OrderStatus.NEW and self.reserved_until <= now

    def expire(self, now: datetime) -> None:
        """Vencer: solo un pedido nuevo cuya reserva ya pasó."""
        if self.status == OrderStatus.NEW and self.reserved_until > now:
            raise InvalidTransition("La reserva de este pedido todavía no vence.")
        self._move_to(OrderStatus.EXPIRED)
        self._record(OrderExpired(self.id, self.store_id, self.number, self.stock_lines))

    # --- Eventos ---

    def _record(self, event: object) -> None:
        self._events.append(event)

    def pull_events(self) -> list[object]:
        """Devuelve los eventos pendientes y los borra (los publica el caso de uso)."""
        events, self._events = self._events, []
        return events
