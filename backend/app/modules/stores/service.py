"""Lógica de stores (módulo simple): leer tiendas, zonas y numerar pedidos."""

import re
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy import text as sql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.subscriptions.public import get_subscription, start_free_plan
from app.shared.domain.ids import new_id
from app.shared.domain.phone import PhoneNumber
from app.shared.domain.slug import Slug
from app.shared.errors import Conflict, NotFound, ValidationFailed
from app.shared.validation import FieldErrors, is_int, is_object, text

from .models import DeliveryZoneModel, StoreMemberModel, StoreModel
from .schemas import DeliveryZone, SlugAvailability, Store

WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
PAYMENT_METHODS = ("yape", "plin", "cash", "transfer")
TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_PRICE_CENTS = 10_000_000
LIMITS = {"name": 60, "description": 300, "city": 60, "instructions": 300, "address": 200, "owner_name": 60}
FEATURE_FLAGS = ("deliveryDate", "madeToOrder", "sizeGuide", "deliveryZones", "pickup", "shipping")
DEFAULT_HOURS = {"open": "09:00", "close": "19:00"}


def find_store_by_slug(session: Session, slug: str) -> StoreModel:
    """Solo tiendas activas: las demás no existen para el público."""
    store = session.scalar(select(StoreModel).where(StoreModel.slug == slug.strip().lower(), StoreModel.active))
    if store is None:
        raise NotFound("Esta tienda no existe.")
    return store


def to_store(session: Session, model: StoreModel) -> Store:
    subscription = get_subscription(session, model.id)
    return Store(
        id=model.id,
        slug=model.slug,
        name=model.name,
        description=model.description,
        logo_url=model.logo_url,
        cover_url=model.cover_url,
        city=model.city,
        whatsapp=model.whatsapp,
        business_hours=model.business_hours,  # type: ignore[arg-type]
        payment_methods=model.payment_methods,  # type: ignore[arg-type]
        payment_instructions=model.payment_instructions,
        features=model.features,  # type: ignore[arg-type]
        pickup_address=model.pickup_address,
        shipping_fee_cents=model.shipping_fee_cents,
        reservation_hours=model.reservation_hours,
        plan=subscription.plan,  # type: ignore[arg-type]
        plan_expires_at=subscription.expires_at,
    )


def find_store_of_member(session: Session, user_id: str) -> StoreModel | None:
    """La tienda activa del usuario. Si tuviera varias, siempre la misma: la primera a la que se unió."""
    return session.scalar(
        select(StoreModel)
        .join(StoreMemberModel, StoreMemberModel.store_id == StoreModel.id)
        .where(StoreMemberModel.user_id == user_id, StoreModel.active)
        .order_by(StoreMemberModel.created_at, StoreModel.id)
        .limit(1)
    )


def zones_of(session: Session, store_id: str, *, only_active: bool) -> list[DeliveryZone]:
    query = select(DeliveryZoneModel).where(DeliveryZoneModel.store_id == store_id)
    if only_active:
        query = query.where(DeliveryZoneModel.active)
    rows = session.scalars(query.order_by(DeliveryZoneModel.position, DeliveryZoneModel.name))
    return [DeliveryZone(id=z.id, name=z.name, price_cents=z.price_cents, active=z.active) for z in rows]


def check_slug(session: Session, slug: str) -> SlugAvailability:
    """Libre si tiene el formato correcto, no está reservado y ninguna tienda lo usa."""
    parsed = Slug.parse(slug)
    if parsed is None:
        return SlugAvailability(available=False)
    taken = session.scalar(select(StoreModel.id).where(StoreModel.slug == parsed.value))
    return SlugAvailability(available=taken is None)


def take_order_number(session: Session, store_id: str) -> int:
    """
    Reserva el siguiente número de pedido de la tienda con un UPDATE atómico: dos pedidos a la vez
    nunca reciben el mismo. Si la transacción se deshace, el número no se pierde.
    """
    number = session.execute(
        update(StoreModel)
        .where(StoreModel.id == store_id)
        .values(next_order_number=StoreModel.next_order_number + 1)
        .returning(StoreModel.next_order_number - 1)
    ).scalar_one()
    return int(number)


def create_store(session: Session, user_id: str, body: Any) -> StoreModel:
    """POST /me/store: crea la tienda con las funciones según las preguntas del registro (SPEC.md, sección 3)."""
    data = body if is_object(body) else {}
    answers = data.get("answers") if is_object(data.get("answers")) else {}
    errors = FieldErrors()

    owner_name = text(data.get("ownerName"))
    if not 2 <= len(owner_name) <= LIMITS["owner_name"]:
        errors.add("ownerName", "Escribe tu nombre.")
    name = text(data.get("name"))
    if not 2 <= len(name) <= LIMITS["name"]:
        errors.add("name", "Escribe el nombre de tu negocio (de 2 a 60 letras).")
    slug = text(data.get("slug")).lower()
    if not check_slug(session, slug).available:
        errors.add("slug", "Este link no está disponible. Prueba con otro.")
    phone = PhoneNumber.parse(text(data.get("whatsapp")))
    if phone is None:
        errors.add("whatsapp", "Escribe un celular de 9 dígitos que empiece con 9.")
    city = text(data.get("city"))
    if not city or len(city) > LIMITS["city"]:
        errors.add("city", "Escribe tu ciudad o distrito.")
    errors.throw_if_any("Revisa los datos de tu tienda.")

    # Una tienda por dueño: el bloqueo evita crear dos si se envía el registro dos veces a la vez
    session.execute(sql("select pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": f"registro:{user_id}"})
    if session.scalar(select(StoreMemberModel.store_id).where(StoreMemberModel.user_id == user_id)) is not None:
        raise Conflict("Ya tienes una tienda.", code="store_exists")

    made_to_order = answers.get("madeToOrder") is True
    store = StoreModel(
        id=new_id("st"),
        owner_id=user_id,
        slug=slug,
        name=name,
        description="",
        logo_url=None,
        cover_url=None,
        city=city,
        whatsapp=phone.whatsapp,
        business_hours={day: None if day == "sun" else DEFAULT_HOURS for day in WEEKDAYS},
        payment_methods=["yape", "cash"],
        payment_instructions=None,
        features={
            "deliveryDate": answers.get("deliveryDate") is True,
            "leadTimeDays": 1 if made_to_order else 0,
            "madeToOrder": made_to_order,
            "sizeGuide": False,
            "deliveryZones": False,
            # Siempre hay al menos un tipo de entrega activo
            "pickup": True,
            "shipping": answers.get("shipping") is True,
        },
        pickup_address=None,
        shipping_fee_cents=None,
        reservation_hours=24,
        next_order_number=1,
    )
    session.add(store)
    try:
        session.flush()
    except IntegrityError as error:
        # Otra persona tomó el mismo link justo ahora
        raise ValidationFailed(
            "Revisa los datos de tu tienda.", fields={"slug": "Este link no está disponible. Prueba con otro."}
        ) from error
    session.add(StoreMemberModel(store_id=store.id, user_id=user_id, role="owner"))
    session.flush()
    start_free_plan(session, store.id)
    return store


def _validate_features(value: Any, current: dict[str, Any], errors: FieldErrors) -> dict[str, Any]:
    if not is_object(value):
        errors.add("features", "Las funciones no son válidas.")
        return current
    merged = dict(current)
    for key in FEATURE_FLAGS:
        if key not in value:
            continue
        if isinstance(value[key], bool):
            merged[key] = value[key]
        else:
            errors.add(f"features.{key}", "Debe ser sí o no.")
    if "leadTimeDays" in value:
        if is_int(value["leadTimeDays"], 0, 30):
            merged["leadTimeDays"] = value["leadTimeDays"]
        else:
            errors.add("features.leadTimeDays", "Escribe de 0 a 30 días.")
    if not merged["deliveryZones"] and not merged["pickup"] and not merged["shipping"]:
        errors.add("features", "Activa al menos una forma de entrega: delivery, recojo o envío.")
    return merged


def _validate_hours(value: Any, errors: FieldErrors) -> dict[str, Any] | None:
    if not is_object(value):
        errors.add("businessHours", "El horario no es válido.")
        return None
    hours: dict[str, Any] = {}
    for day in WEEKDAYS:
        entry = value.get(day)
        if entry is None:
            hours[day] = None
            continue
        opening = text(entry.get("open")) if is_object(entry) else ""
        closing = text(entry.get("close")) if is_object(entry) else ""
        if not TIME_PATTERN.match(opening) or not TIME_PATTERN.match(closing) or opening >= closing:
            errors.add(f"businessHours.{day}", "La hora de cierre debe ser después de la de apertura.")
        else:
            hours[day] = {"open": opening, "close": closing}
    return hours


def update_store(session: Session, store_id: str, body: Any) -> StoreModel:
    """PATCH /me/store: cambia solo los campos que vienen. El link no se puede cambiar."""
    store = session.scalar(select(StoreModel).where(StoreModel.id == store_id).with_for_update())
    if store is None:
        raise NotFound("Esta tienda no existe.")
    data = body if is_object(body) else {}
    errors = FieldErrors()
    patch: dict[str, Any] = {}

    if "slug" in data:
        errors.add("slug", "El link de la tienda no se puede cambiar.")
    if "name" in data:
        name = text(data["name"])
        if 2 <= len(name) <= LIMITS["name"]:
            patch["name"] = name
        else:
            errors.add("name", "Escribe el nombre de tu negocio (de 2 a 60 letras).")
    if "description" in data:
        description = text(data["description"])
        if len(description) <= LIMITS["description"]:
            patch["description"] = description
        else:
            errors.add("description", "Máximo 300 letras.")
    for key, column in (("logoUrl", "logo_url"), ("coverUrl", "cover_url")):
        if key in data:
            if data[key] is not None and not text(data[key]):
                errors.add(key, "La imagen no es válida.")
            else:
                patch[column] = None if data[key] is None else text(data[key])
    if "city" in data:
        city = text(data["city"])
        if city and len(city) <= LIMITS["city"]:
            patch["city"] = city
        else:
            errors.add("city", "Escribe tu ciudad o distrito.")
    if "whatsapp" in data:
        phone = PhoneNumber.parse(text(data["whatsapp"]))
        if phone is None:
            errors.add("whatsapp", "Escribe un celular de 9 dígitos que empiece con 9.")
        else:
            patch["whatsapp"] = phone.whatsapp
    if "businessHours" in data:
        hours = _validate_hours(data["businessHours"], errors)
        if hours is not None:
            patch["business_hours"] = hours
    if "paymentMethods" in data:
        methods = data["paymentMethods"] if isinstance(data["paymentMethods"], list) else []
        valid = [method for method in PAYMENT_METHODS if method in methods]
        if not valid or len(valid) != len(methods):
            errors.add("paymentMethods", "Elige al menos un método de pago.")
        else:
            patch["payment_methods"] = valid
    if "paymentInstructions" in data:
        instructions = text(data["paymentInstructions"])
        if len(instructions) <= LIMITS["instructions"]:
            patch["payment_instructions"] = instructions or None
        else:
            errors.add("paymentInstructions", "Máximo 300 letras.")
    if "pickupAddress" in data:
        address = text(data["pickupAddress"])
        if len(address) <= LIMITS["address"]:
            patch["pickup_address"] = address or None
        else:
            errors.add("pickupAddress", "La dirección es muy larga.")
    if "shippingFeeCents" in data:
        fee = data["shippingFeeCents"]
        if fee is None or is_int(fee, 0, MAX_PRICE_CENTS):
            patch["shipping_fee_cents"] = fee
        else:
            errors.add("shippingFeeCents", "Escribe un precio válido o déjalo a coordinar.")
    if "reservationHours" in data:
        if is_int(data["reservationHours"], 1, 168):
            patch["reservation_hours"] = data["reservationHours"]
        else:
            errors.add("reservationHours", "Escribe de 1 a 168 horas.")
    if "features" in data:
        patch["features"] = _validate_features(data["features"], store.features, errors)

    errors.throw_if_any("Revisa los datos de tu tienda.")
    for column, value in patch.items():
        setattr(store, column, value)
    session.flush()
    return store


def save_zones(session: Session, store_id: str, body: Any) -> list[DeliveryZone]:
    """PUT /me/zones: reemplaza la lista completa. Sin id = nueva; las que no vienen se borran."""
    if not isinstance(body, list):
        raise ValidationFailed("La lista de zonas no es válida.")
    current = {
        z.id: z for z in session.scalars(select(DeliveryZoneModel).where(DeliveryZoneModel.store_id == store_id))
    }
    errors = FieldErrors()
    names: set[str] = set()
    used_ids: set[str] = set()
    parsed = []
    for index, raw in enumerate(body):
        zone = raw if is_object(raw) else {}
        name = text(zone.get("name"))
        if not name or len(name) > LIMITS["city"]:
            errors.add(f"{index}.name", "Escribe el nombre del distrito o zona.")
        elif name.lower() in names:
            errors.add(f"{index}.name", "Esta zona está repetida.")
        names.add(name.lower())
        if not is_int(zone.get("priceCents"), 0, MAX_PRICE_CENTS):
            errors.add(f"{index}.priceCents", "Escribe un precio válido.")
        if not isinstance(zone.get("active"), bool):
            errors.add(f"{index}.active", "Indica si la zona está activa.")
        zone_id = zone.get("id")
        # Solo zonas de esta tienda: el id de una zona ajena no existe aquí
        if zone_id is not None and (zone_id not in current or zone_id in used_ids):
            errors.add(f"{index}.id", "Esta zona no existe.")
        if zone_id is not None:
            used_ids.add(zone_id)
        parsed.append((zone_id, name, zone.get("priceCents"), zone.get("active")))
    errors.throw_if_any("Revisa las zonas de delivery.")

    removed = set(current) - used_ids
    if removed:
        session.execute(delete(DeliveryZoneModel).where(DeliveryZoneModel.id.in_(removed)))
    for position, (zone_id, name, price, active) in enumerate(parsed):
        if zone_id is None:
            session.add(
                DeliveryZoneModel(
                    id=new_id("zn"), store_id=store_id, name=name, price_cents=price, active=active, position=position
                )
            )
        else:
            row = current[zone_id]
            row.name, row.price_cents, row.active, row.position = name, price, active, position
    session.flush()
    return zones_of(session, store_id, only_active=False)
