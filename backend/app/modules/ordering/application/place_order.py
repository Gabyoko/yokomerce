"""
Caso de uso: crear un pedido desde la tienda pública (SPEC.md, secciones 7 y 12).

1. Valida todo y junta los errores por campo, con las mismas claves y mensajes que la API de prueba
   ("customer.phone", "items.0.quantity"…) para que el checkout los muestre en su lugar.
2. Precios, nombres y opciones salen de catalog (nunca del navegador); las funciones activas, de stores.
3. Crea el agregado Order, lo guarda y publica OrderPlaced: inventory reserva con un UPDATE atómico.
   Si algo no alcanza, OutOfStock y se deshace todo (no queda pedido ni reserva).
"""

from datetime import date, datetime, timedelta
from typing import Any

from app.modules.catalog.public import OrderableVariant, variants_for_order
from app.modules.stores.public import Store, active_zones, get_store_by_slug, take_order_number
from app.shared.db import UnitOfWork
from app.shared.domain.ids import new_id, new_public_token
from app.shared.domain.money import Money
from app.shared.domain.phone import PhoneNumber
from app.shared.domain.time import add_days, today_in_lima, utc_now, weekday_key
from app.shared.errors import RateLimited, ValidationFailed

from ..domain.order import Fulfillment, FulfillmentType, Order, OrderItem, PaymentMethod
from ..infrastructure import repository

MAX_QUANTITY = 99
ORDERS_PER_HOUR_PER_PHONE = 5
NAME_LENGTH = (2, 60)
ADDRESS_MAX = 200
REFERENCE_MAX = 200
CITY_MAX = 60
MAX_ORDER_CENTS = 2_000_000_000


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _obj(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _validate(session: Any, body: dict[str, Any], store: Store, now: datetime) -> tuple[dict[str, Any], dict[str, str]]:
    """Devuelve los datos limpios y los errores por campo (vacío si todo está bien)."""
    fields: dict[str, str] = {}
    features = store.features

    # Cliente
    customer = _obj(body.get("customer"))
    name = _text(customer.get("name"))
    if not NAME_LENGTH[0] <= len(name) <= NAME_LENGTH[1]:
        fields["customer.name"] = f"Escribe tu nombre (de {NAME_LENGTH[0]} a {NAME_LENGTH[1]} letras)."
    phone = PhoneNumber.parse(_text(customer.get("phone")))
    if phone is None:
        fields["customer.phone"] = "Escribe un celular de 9 dígitos que empiece con 9."

    # Pago: uno que la tienda acepte
    payment = body.get("paymentMethod")
    if payment not in {m.value for m in PaymentMethod} or payment not in store.payment_methods:
        fields["paymentMethod"] = "Elige un método de pago que acepte la tienda."

    # Entrega: solo los tipos activos en la tienda
    f = _obj(body.get("fulfillment"))
    kind = f.get("type")
    enabled = {
        "delivery": features.delivery_zones,
        "pickup": features.pickup,
        "shipping": features.shipping,
    }
    address, reference, city = _text(f.get("address")), _text(f.get("reference")), _text(f.get("city"))
    zone = None
    fee: int | None = 0
    if kind not in enabled or not enabled[kind]:
        fields["fulfillment.type"] = "Elige una forma de entrega que ofrezca la tienda."
    elif kind == "delivery":
        zone = next((z for z in active_zones(session, store) if z.id == f.get("zoneId")), None)
        if zone is None:
            fields["fulfillment.zoneId"] = "Elige tu distrito."
        else:
            fee = zone.price_cents
    elif kind == "shipping":
        if not city or len(city) > CITY_MAX:
            fields["fulfillment.city"] = "Escribe tu ciudad."
        fee = store.shipping_fee_cents
    if kind in ("delivery", "shipping") and (not address or len(address) > ADDRESS_MAX):
        fields["fulfillment.address"] = "Escribe la dirección de entrega."
    if len(reference) > REFERENCE_MAX:
        fields["fulfillment.reference"] = "La referencia es muy larga."

    # Fecha de entrega: solo si la función está activa
    delivery_date: date | None = None
    raw_date = body.get("deliveryDate")
    if features.delivery_date:
        earliest = add_days(today_in_lima(now), features.lead_time_days)
        try:
            chosen = date.fromisoformat(_text(raw_date)) if len(_text(raw_date)) == 10 else None
        except ValueError:
            chosen = None
        if chosen is None:
            fields["deliveryDate"] = "Elige el día de entrega."
        elif chosen < earliest:
            days = features.lead_time_days
            fields["deliveryDate"] = (
                f"Pide con al menos {days} {'día' if days == 1 else 'días'} de anticipación."
                if days > 0
                else "Elige una fecha desde hoy."
            )
        elif getattr(store.business_hours, weekday_key(chosen)) is None:
            fields["deliveryDate"] = "La tienda no atiende ese día."
        else:
            delivery_date = chosen
    elif raw_date is not None:
        fields["deliveryDate"] = "Esta tienda no permite elegir fecha de entrega."

    # Ítems: precios y datos tomados de lo guardado
    raw_items = body.get("items") if isinstance(body.get("items"), list) else []
    if not raw_items:
        fields["items"] = "Tu carrito está vacío."
    wanted = [_text(_obj(raw).get("variantId")) for raw in raw_items]
    variants = variants_for_order(session, store, [v for v in wanted if v])
    items: list[OrderItem] = []
    for index, raw in enumerate(raw_items):
        key, entry = f"items.{index}", _obj(raw)
        variant: OrderableVariant | None = variants.get(wanted[index])
        if variant is None or not variant.orderable:
            fields[f"{key}.variantId"] = "Este producto ya no está disponible."
            continue
        quantity = entry.get("quantity")
        if not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= MAX_QUANTITY:
            fields[f"{key}.quantity"] = f"La cantidad debe ser de 1 a {MAX_QUANTITY}."
            quantity = 0
        raw_values = _obj(entry.get("customValues"))
        values: dict[str, str] = {}
        for field in variant.custom_fields:
            value = _text(raw_values.get(field.label))
            if field.required and not value:
                fields[f"{key}.customValues.{field.label}"] = f'Completa "{field.label}".'
            elif len(value) > field.max_length:
                fields[f"{key}.customValues.{field.label}"] = f"Máximo {field.max_length} letras."
            elif value:
                values[field.label] = value
        for label in raw_values:
            if not any(field.label == label for field in variant.custom_fields):
                fields[f"{key}.customValues.{label}"] = "Este campo no existe en el producto."
        items.append(
            OrderItem(
                variant_id=variant.variant_id,
                product_name=variant.product_name,
                variant_label=variant.variant_label,
                unit_price=Money(variant.price_cents),
                quantity=quantity,
                custom_values=values,
                tracks_stock=not variant.made_to_order,
            )
        )

    clean = {
        "name": name,
        "phone": phone.digits if phone else "",
        "payment": payment,
        "fulfillment": Fulfillment(
            type=FulfillmentType(kind) if kind in enabled else FulfillmentType.PICKUP,
            zone_id=zone.id if zone else None,
            zone_name=zone.name if zone else None,
            city=city if kind == "shipping" else None,
            address=None if kind == "pickup" else address,
            reference=None if kind == "pickup" or not reference else reference,
        ),
        "fee": fee,
        "delivery_date": delivery_date,
        "items": items,
    }
    return clean, fields


def place_order(uow: UnitOfWork, body: Any) -> Order:
    if not isinstance(body, dict):
        raise ValidationFailed("Revisa los datos del pedido.", fields={"body": "El pedido no es válido."}, ok=False)
    session = uow.session
    now = utc_now().replace(microsecond=0)
    store = get_store_by_slug(session, _text(body.get("storeSlug")))

    clean, fields = _validate(session, body, store, now)
    if fields:
        raise ValidationFailed("Revisa los datos del pedido.", fields=fields, ok=False)

    if sum(item.line_total.cents for item in clean["items"]) > MAX_ORDER_CENTS:
        raise ValidationFailed(
            "Revisa los datos del pedido.", fields={"items": "El pedido supera el monto máximo."}, ok=False
        )

    if repository.count_since_by_phone(session, clean["phone"], now - timedelta(hours=1)) >= ORDERS_PER_HOUR_PER_PHONE:
        raise RateLimited("Hiciste varios pedidos seguidos. Espera un rato e inténtalo otra vez.", ok=False)

    order = Order.place(
        id=new_id("or"),
        store_id=store.id,
        number=take_order_number(session, store.id),
        public_token=new_public_token(),
        customer_name=clean["name"],
        customer_phone=clean["phone"],
        fulfillment=clean["fulfillment"],
        delivery_date=clean["delivery_date"],
        payment_method=PaymentMethod(clean["payment"]),
        items=clean["items"],
        delivery_fee=None if clean["fee"] is None else Money(clean["fee"]),
        reserved_until=now + timedelta(hours=store.reservation_hours),
        created_at=now,
    )
    repository.add(session, order)
    uow.publish(*order.pull_events())  # type: ignore[arg-type]
    # Aquí inventory reserva el stock; si no alcanza lanza OutOfStock y se deshace todo
    uow.commit()
    return order
