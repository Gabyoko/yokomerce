"""Guarda y carga el agregado Order en orders y order_items."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.shared.domain.money import Money

from ..domain.order import Fulfillment, FulfillmentType, Order, OrderItem, OrderStatus, PaymentMethod
from .models import OrderItemModel, OrderModel


def add(session: Session, order: Order) -> None:
    session.add(
        OrderModel(
            id=order.id,
            store_id=order.store_id,
            number=order.number,
            public_token=order.public_token,
            status=order.status.value,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            fulfillment_type=order.fulfillment.type.value,
            delivery_zone_id=order.fulfillment.zone_id,
            zone_name=order.fulfillment.zone_name,
            city=order.fulfillment.city,
            address=order.fulfillment.address,
            reference=order.fulfillment.reference,
            delivery_date=order.delivery_date,
            payment_method=order.payment_method.value,
            subtotal_cents=order.subtotal.cents,
            delivery_fee_cents=None if order.delivery_fee is None else order.delivery_fee.cents,
            total_cents=order.total.cents,
            reserved_until=order.reserved_until,
            created_at=order.created_at,
            paid_at=order.paid_at,
            delivered_at=order.delivered_at,
            cancelled_at=order.cancelled_at,
            notes=order.notes,
        )
    )
    # Sin relaciones declaradas entre modelos: el pedido se guarda antes que sus ítems
    session.flush()
    session.add_all(
        OrderItemModel(
            id=f"{order.id}_{position}",
            order_id=order.id,
            variant_id=item.variant_id,
            product_name=item.product_name,
            variant_label=item.variant_label,
            unit_price_cents=item.unit_price.cents,
            quantity=item.quantity,
            line_total_cents=item.line_total.cents,
            custom_values=item.custom_values,
            tracks_stock=item.tracks_stock,
            position=position,
        )
        for position, item in enumerate(order.items)
    )
    session.flush()


def _to_domain(row: OrderModel, items: list[OrderItemModel]) -> Order:
    return Order(
        id=row.id,
        store_id=row.store_id,
        number=row.number,
        public_token=row.public_token,
        status=OrderStatus(row.status),
        customer_name=row.customer_name,
        customer_phone=row.customer_phone,
        fulfillment=Fulfillment(
            type=FulfillmentType(row.fulfillment_type),
            zone_id=row.delivery_zone_id,
            zone_name=row.zone_name,
            city=row.city,
            address=row.address,
            reference=row.reference,
        ),
        delivery_date=row.delivery_date,
        payment_method=PaymentMethod(row.payment_method),
        items=[
            OrderItem(
                variant_id=i.variant_id,
                product_name=i.product_name,
                variant_label=i.variant_label,
                unit_price=Money(i.unit_price_cents),
                quantity=i.quantity,
                custom_values=dict(i.custom_values),
                tracks_stock=i.tracks_stock,
            )
            for i in sorted(items, key=lambda i: i.position)
        ],
        delivery_fee=None if row.delivery_fee_cents is None else Money(row.delivery_fee_cents),
        reserved_until=row.reserved_until,
        created_at=row.created_at,
        paid_at=row.paid_at,
        delivered_at=row.delivered_at,
        cancelled_at=row.cancelled_at,
        notes=row.notes,
    )


def get_by_token(session: Session, store_id: str, token: str) -> Order | None:
    row = session.scalar(select(OrderModel).where(OrderModel.store_id == store_id, OrderModel.public_token == token))
    if row is None:
        return None
    items = list(session.scalars(select(OrderItemModel).where(OrderItemModel.order_id == row.id)))
    return _to_domain(row, items)


def count_since_by_phone(session: Session, phone: str, since: datetime) -> int:
    """Pedidos hechos con este celular desde `since`, en todas las tiendas (límite por hora)."""
    return (
        session.scalar(
            select(func.count())
            .select_from(OrderModel)
            .where(OrderModel.customer_phone == phone, OrderModel.created_at > since)
        )
        or 0
    )


def _items_of(session: Session, order_ids: list[str]) -> dict[str, list[OrderItemModel]]:
    items: dict[str, list[OrderItemModel]] = {order_id: [] for order_id in order_ids}
    if order_ids:
        for item in session.scalars(select(OrderItemModel).where(OrderItemModel.order_id.in_(order_ids))):
            items[item.order_id].append(item)
    return items


def get(session: Session, store_id: str, order_id: str) -> Order | None:
    """Solo pedidos de esta tienda: el de otra no existe para este dueño."""
    row = session.scalar(select(OrderModel).where(OrderModel.id == order_id, OrderModel.store_id == store_id))
    return None if row is None else _to_domain(row, _items_of(session, [row.id])[row.id])


def get_for_update(session: Session, store_id: str, order_id: str) -> Order | None:
    """Como `get`, pero nadie más puede cambiar el pedido hasta que termine la transacción."""
    row = session.scalar(
        select(OrderModel)
        .where(OrderModel.id == order_id, OrderModel.store_id == store_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return None if row is None else _to_domain(row, _items_of(session, [row.id])[row.id])


def save(session: Session, order: Order) -> None:
    """Guarda lo que puede cambiar después de creado el pedido."""
    row = session.get(OrderModel, order.id)
    row.status = order.status.value
    row.paid_at = order.paid_at
    row.delivered_at = order.delivered_at
    row.cancelled_at = order.cancelled_at
    row.notes = order.notes
    session.flush()


def list_for_store(session: Session, store_id: str, status: str | None) -> list[Order]:
    """Más recientes primero."""
    query = select(OrderModel).where(OrderModel.store_id == store_id)
    if status is not None:
        query = query.where(OrderModel.status == status)
    rows = list(session.scalars(query.order_by(OrderModel.created_at.desc(), OrderModel.number.desc())))
    items = _items_of(session, [row.id for row in rows])
    return [_to_domain(row, items[row.id]) for row in rows]


def ids_due_to_expire(session: Session, now: datetime) -> list[tuple[str, str]]:
    rows = session.execute(
        select(OrderModel.store_id, OrderModel.id).where(OrderModel.status == "new", OrderModel.reserved_until <= now)
    )
    return [(store_id, order_id) for store_id, order_id in rows]
