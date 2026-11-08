"""Lecturas de pedidos y su conversión al contrato."""

from app.modules.stores.public import get_store_by_slug
from app.shared.db import UnitOfWork
from app.shared.errors import NotFound

from ..domain.order import Order
from ..infrastructure import repository
from ..interfaces.schemas import Customer, Fulfillment, OrderItem, PublicOrder
from ..interfaces.schemas import Order as OrderOut


def to_public_order(order: Order) -> PublicOrder:
    return PublicOrder(
        number=order.number,
        public_token=order.public_token,
        status=order.status.value,
        customer=Customer(name=order.customer_name, phone=order.customer_phone),
        fulfillment=Fulfillment(
            type=order.fulfillment.type.value,
            zone_name=order.fulfillment.zone_name,
            city=order.fulfillment.city,
            address=order.fulfillment.address,
            reference=order.fulfillment.reference,
        ),
        delivery_date=order.delivery_date,
        payment_method=order.payment_method.value,
        items=[
            OrderItem(
                variant_id=i.variant_id,
                product_name=i.product_name,
                variant_label=i.variant_label,
                unit_price_cents=i.unit_price.cents,
                quantity=i.quantity,
                line_total_cents=i.line_total.cents,
                custom_values=i.custom_values,
                tracks_stock=i.tracks_stock,
            )
            for i in order.items
        ],
        subtotal_cents=order.subtotal.cents,
        delivery_fee_cents=None if order.delivery_fee is None else order.delivery_fee.cents,
        total_cents=order.total.cents,
        reserved_until=order.reserved_until,
        created_at=order.created_at,
        paid_at=order.paid_at,
        delivered_at=order.delivered_at,
        cancelled_at=order.cancelled_at,
    )


def to_order(order: Order) -> OrderOut:
    """Pedido como lo ve el dueño: lo mismo que el cliente, más el id y la nota interna."""
    public = to_public_order(order)
    return OrderOut(
        **{name: getattr(public, name) for name in PublicOrder.model_fields}, id=order.id, notes=order.notes
    )


def get_public_order(uow: UnitOfWork, slug: str, token: str) -> PublicOrder:
    """El cliente solo puede leer un pedido con su token (SPEC.md, sección 12)."""
    store = get_store_by_slug(uow.session, slug)
    order = repository.get_by_token(uow.session, store.id, token)
    if order is None:
        raise NotFound("No encontramos este pedido.")
    return to_public_order(order)
