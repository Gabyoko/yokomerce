"""Esquemas de ordering: coinciden campo por campo con frontend/shared/types/order.ts."""

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.shared.schemas import CamelModel

OrderStatus = Literal["new", "paid", "preparing", "delivered", "cancelled", "expired"]
FulfillmentType = Literal["delivery", "pickup", "shipping"]
PaymentMethod = Literal["yape", "plin", "cash", "transfer"]


# --- Entrada: POST /public/orders (CreateOrderInput) ---


class OrderLineInput(CamelModel):
    variant_id: str
    quantity: int
    custom_values: dict[str, str] = {}


class CustomerInput(CamelModel):
    name: str
    phone: str


class FulfillmentInput(CamelModel):
    type: FulfillmentType
    zone_id: str | None = None
    city: str | None = None
    address: str | None = None
    reference: str | None = None


class CreateOrderInput(CamelModel):
    """Documenta la entrada en /docs. La validación real la hace place_order, con las claves del input."""

    store_slug: str
    items: list[OrderLineInput]
    customer: CustomerInput
    fulfillment: FulfillmentInput
    delivery_date: date | None = None
    payment_method: PaymentMethod


class OrderNotesInput(CamelModel):
    notes: str | None


# --- Salida ---


class OrderItem(CamelModel):
    variant_id: str
    product_name: str = Field(description="Copia al momento del pedido")
    variant_label: str
    unit_price_cents: int
    quantity: int
    line_total_cents: int
    custom_values: dict[str, str]
    tracks_stock: bool


class Customer(CamelModel):
    name: str
    phone: str


class Fulfillment(CamelModel):
    type: FulfillmentType
    zone_name: str | None
    city: str | None
    address: str | None
    reference: str | None


class PublicOrder(CamelModel):
    """Lo que ve el cliente en /[slug]/pedido/[token]: el pedido sin id interno ni notas."""

    number: int
    public_token: str
    status: OrderStatus
    customer: Customer
    fulfillment: Fulfillment
    delivery_date: date | None
    payment_method: PaymentMethod
    items: list[OrderItem]
    subtotal_cents: int
    delivery_fee_cents: int | None = Field(description='null = envío "a coordinar"')
    total_cents: int
    reserved_until: datetime
    created_at: datetime
    paid_at: datetime | None
    delivered_at: datetime | None
    cancelled_at: datetime | None


class Order(PublicOrder):
    """Pedido como lo ve el dueño en el panel."""

    id: str
    notes: str | None


class CreateOrderSuccess(CamelModel):
    # Sin valor por defecto: así el contrato dice que `ok` siempre viene en la respuesta
    ok: Literal[True]
    order: PublicOrder
