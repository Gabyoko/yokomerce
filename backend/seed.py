"""
Carga las tres tiendas de prueba (SPEC.md, sección 6) en la base de datos.

    python -m uv run python seed.py

BORRA todos los datos y vuelve a cargarlos. Lee seed_data.json, que es la misma definición que usa
la API de prueba del front (frontend/mocks/data), y la arma igual que frontend/mocks/data/build.ts:
mismos ids, fechas relativas a ahora (en Lima), totales calculados desde las variantes y movimientos
de stock coherentes, aplicados con las reglas del agregado StockItem.
"""

import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

import app.models  # noqa: F401  # registra todas las tablas
from app.modules.catalog.models import (
    CategoryModel,
    CustomFieldModel,
    OptionValueModel,
    ProductImageModel,
    ProductModel,
    ProductOptionModel,
    VariantModel,
    VariantOptionValueModel,
)
from app.modules.iam.models import UserModel
from app.modules.inventory.domain.stock_item import MovementType, StockItem
from app.modules.inventory.infrastructure.models import StockItemModel, StockMovementModel
from app.modules.ordering.infrastructure.models import OrderItemModel, OrderModel
from app.modules.stores.models import DeliveryZoneModel, StoreMemberModel, StoreModel
from app.modules.subscriptions.models import SubscriptionModel
from app.shared.db import Base, get_engine
from app.shared.domain.phone import PhoneNumber
from app.shared.domain.time import add_days, today_in_lima

SEED_FILE = Path(__file__).with_name("seed_data.json")
HOUR = timedelta(hours=1)
# El stock inicial se carga antes del pedido más antiguo (máximo 7 días)
INITIAL_STOCK_AGO = timedelta(days=8)

# Efecto de cada movimiento sobre lo disponible (on_hand - reserved), para calcular el stock inicial
AVAILABLE_EFFECT = {"reserve": -1, "release": 1, "sale": 0, "in": 1, "out": -1}


class SeedError(Exception):
    pass


def slugify(value: str) -> str:
    """ "Verde oliva" → "verde-oliva", "Tamaño" → "tamano" (igual que build.ts)."""
    plain = unicodedata.normalize("NFD", value)
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch)).lower()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", plain))


def _imul(a: int, b: int) -> int:
    """Math.imul de JavaScript: multiplicación de enteros de 32 bits con signo."""
    result = (a * b) & 0xFFFFFFFF
    return result - 0x100000000 if result & 0x80000000 else result


def _to_int32(value: int) -> int:
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value & 0x80000000 else value


def make_token(seed: str) -> str:
    """Mismo token público que build.ts, para que los links de prueba coincidan."""
    hash_ = _to_int32(2166136261)
    for char in seed:
        hash_ = _imul(_to_int32(hash_ ^ ord(char)), 16777619)
    token = ""
    alphabet = "abcdefghijkmnpqrstuvwxyz23456789"
    for i in range(20):
        shifted = (hash_ & 0xFFFFFFFF) >> 15
        hash_ = _to_int32(_imul(_to_int32(hash_ ^ shifted), _to_int32(2246822507)) ^ i)
        token += alphabet[(hash_ & 0xFFFFFFFF) % 32]
    return token


@dataclass
class StockEvent:
    at: datetime
    variant_id: str
    type: str
    amount: int
    reason: str | None
    created_by: str | None
    order_id: str | None = None
    order_number: int | None = None


def build_store(session: Session, seed: dict[str, Any], now: datetime) -> None:
    p, s = seed["idPrefix"], seed["store"]
    features = s["features"]

    def fail(message: str) -> None:
        raise SeedError(f"[datos de prueba · {s['slug']}] {message}")

    # --- Dueño, tienda, plan, zonas y categorías ---
    owner_id, store_id = f"us_{p}", f"st_{p}"
    session.add(UserModel(id=owner_id, email=f"{s['slug']}@yokomerce.test", name=seed["ownerName"]))
    session.add(
        StoreModel(
            id=store_id,
            owner_id=owner_id,
            slug=s["slug"],
            name=s["name"],
            description=s["description"],
            logo_url=s["logoUrl"],
            cover_url=s["coverUrl"],
            city=s["city"],
            whatsapp=s["whatsapp"],
            business_hours=s["businessHours"],
            payment_methods=s["paymentMethods"],
            payment_instructions=s["paymentInstructions"],
            features=features,
            pickup_address=s["pickupAddress"],
            shipping_fee_cents=s["shippingFeeCents"],
            reservation_hours=s["reservationHours"],
            next_order_number=seed["firstOrderNumber"] + len(seed["orders"]),
            created_at=now - INITIAL_STOCK_AGO,
        )
    )
    session.flush()
    session.add(StoreMemberModel(store_id=store_id, user_id=owner_id, role="owner"))
    expires = s["planExpiresInDays"]
    session.add(
        SubscriptionModel(
            store_id=store_id, plan=s["plan"], expires_at=None if expires is None else now + timedelta(days=expires)
        )
    )

    zones: dict[str, DeliveryZoneModel] = {}
    for position, zone in enumerate(seed["zones"]):
        model = DeliveryZoneModel(
            id=f"zn_{p}_{slugify(zone['name'])}",
            store_id=store_id,
            name=zone["name"],
            price_cents=zone["priceCents"],
            active=zone.get("active", True),
            position=position,
        )
        zones[zone["name"]] = model
        session.add(model)

    categories: dict[str, str] = {}
    for position, name in enumerate(seed["categories"]):
        category_id = f"ct_{p}_{slugify(name)}"
        categories[name] = category_id
        session.add(CategoryModel(id=category_id, store_id=store_id, name=name, position=position))
    session.flush()

    # --- Productos, opciones, variantes y campos extra ---
    products: dict[str, dict[str, Any]] = {}
    variants: dict[str, dict[str, Any]] = {}  # "producto|valor|valor" → datos de la variante
    stock: dict[str, StockItem] = {}
    target: dict[str, int] = {}

    for position, sp in enumerate(seed["products"]):
        product_id = f"pr_{p}_{sp['key']}"
        made_to_order = sp.get("madeToOrder", False)
        if sp["category"] not in categories:
            fail(f"categoría {sp['category']!r} no existe")
        if made_to_order and not features["madeToOrder"]:
            fail(f"{sp['key']} es por encargo pero la función está apagada")
        session.add(
            ProductModel(
                id=product_id,
                store_id=store_id,
                category_id=categories[sp["category"]],
                name=sp["name"],
                description=sp["description"],
                made_to_order=made_to_order,
                size_guide_url=sp.get("sizeGuideUrl"),
                visible=sp.get("visible", True),
                position=position,
                created_at=now - INITIAL_STOCK_AGO,
            )
        )
        # Sin relaciones declaradas entre modelos, se guarda el padre antes que los hijos
        session.flush()
        for i, url in enumerate(sp.get("images", [])):
            session.add(ProductImageModel(id=f"pi_{p}_{sp['key']}_{i}", product_id=product_id, url=url, position=i))

        value_ids: list[dict[str, str]] = []
        for option_position, option in enumerate(sp.get("options", [])):
            option_id = f"op_{p}_{sp['key']}_{slugify(option['name'])}"
            session.add(
                ProductOptionModel(id=option_id, product_id=product_id, name=option["name"], position=option_position)
            )
            session.flush()
            ids = {}
            for value_position, value in enumerate(option["values"]):
                value_id = f"{option_id}_{slugify(value)}"
                ids[value] = value_id
                session.add(OptionValueModel(id=value_id, option_id=option_id, value=value, position=value_position))
            value_ids.append(ids)

        for field_position, field in enumerate(sp.get("customFields", [])):
            session.add(
                CustomFieldModel(
                    id=f"cf_{p}_{sp['key']}_{slugify(field['label'])}",
                    product_id=product_id,
                    label=field["label"],
                    required=field["required"],
                    max_length=field["maxLength"],
                    position=field_position,
                )
            )
        session.flush()

        products[sp["key"]] = {"id": product_id, "name": sp["name"], "made_to_order": made_to_order, "seed": sp}
        for variant_position, sv in enumerate(sp["variants"]):
            values = sv["values"]
            if len(values) != len(value_ids):
                fail(f"{sp['key']}: la variante {values} no coincide con sus opciones")
            suffix = "" if not values else "_" + "_".join(slugify(v) for v in values)
            variant_id = f"va_{p}_{sp['key']}{suffix}"
            session.add(
                VariantModel(
                    id=variant_id,
                    store_id=store_id,
                    product_id=product_id,
                    label=" / ".join(values),
                    price_cents=sv["priceCents"],
                    active=sv.get("active", True),
                    position=variant_position,
                )
            )
            session.flush()
            for option_index, value in enumerate(values):
                session.add(
                    VariantOptionValueModel(
                        variant_id=variant_id, option_value_id=value_ids[option_index][value], position=option_index
                    )
                )
            if made_to_order and sv["available"] != 0:
                fail(f"{sp['key']} es por encargo: su stock debe ser 0")
            variants["|".join([sp["key"], *values])] = {
                "id": variant_id,
                "label": " / ".join(values),
                "price_cents": sv["priceCents"],
                "active": sv.get("active", True),
            }
            stock[variant_id] = StockItem(variant_id, store_id, low_stock_threshold=sv.get("lowStockThreshold"))
            target[variant_id] = sv["available"]

    def find_variant(product_key: str, values: list[str] | None) -> tuple[dict[str, Any], dict[str, Any]]:
        product = products.get(product_key)
        variant = variants.get("|".join([product_key, *(values or [])]))
        if product is None or variant is None:
            fail(f"{product_key}: variante {values} no existe")
        return product, variant  # type: ignore[return-value]

    # --- Pedidos ---
    events: list[StockEvent] = []
    owner = seed["ownerName"]
    for index, so in enumerate(seed["orders"]):
        number = seed["firstOrderNumber"] + index
        label = f"pedido #{number}"
        created = now - so["hoursAgo"] * HOUR
        reserved_until = created + s["reservationHours"] * HOUR
        status = so["status"]
        if status == "new" and reserved_until <= now:
            fail(f"{label} es nuevo pero su reserva ya venció")
        if status == "expired" and reserved_until > now:
            fail(f"{label} está vencido pero su reserva sigue vigente")

        was_paid = status in ("paid", "preparing", "delivered") or (
            status == "cancelled" and so.get("cancelledFrom") == "paid"
        )
        paid_at = created + timedelta(minutes=so.get("paidAfterMinutes", 30)) if was_paid else None
        deliver_at = None if so.get("deliverAfterHours") is None else created + so["deliverAfterHours"] * HOUR
        delivered_at = deliver_at if status == "delivered" else None
        cancelled_at = (paid_at or created) + 2 * HOUR if status == "cancelled" else None

        delivery_date = None
        if features["deliveryDate"]:
            if deliver_at is None:
                fail(f"{label} necesita deliverAfterHours")
            delivery_date = today_in_lima(deliver_at)
            if delivery_date < add_days(today_in_lima(created), features["leadTimeDays"]):
                fail(f"{label} no respeta los días de anticipación")

        f = so["fulfillment"]
        zone = None
        if f["type"] == "delivery":
            zone = zones.get(f.get("zone", ""))
            if zone is None or not zone.active:
                fail(f"{label}: zona {f.get('zone')!r} no existe o no está activa")
            fee = zone.price_cents  # type: ignore[union-attr]
        elif f["type"] == "pickup":
            fee = 0
        else:
            fee = s["shippingFeeCents"]

        phone = PhoneNumber.parse(so["customer"]["phone"])
        if phone is None:
            fail(f"{label}: celular inválido")

        order_id = f"or_{p}_{number}"
        items = []
        for position, item in enumerate(so["items"]):
            product, variant = find_variant(item["product"], item.get("variant"))
            quantity = item["quantity"]
            items.append(
                OrderItemModel(
                    id=f"oi_{p}_{number}_{position}",
                    order_id=order_id,
                    variant_id=variant["id"],
                    product_name=product["name"],
                    variant_label=variant["label"],
                    unit_price_cents=variant["price_cents"],
                    quantity=quantity,
                    line_total_cents=variant["price_cents"] * quantity,
                    custom_values=item.get("customValues", {}),
                    tracks_stock=not product["made_to_order"],
                    position=position,
                )
            )
        subtotal = sum(i.line_total_cents for i in items)
        session.add(
            OrderModel(
                id=order_id,
                store_id=store_id,
                number=number,
                public_token=make_token(f"{p}-{number}"),
                status=status,
                customer_name=so["customer"]["name"].strip(),
                customer_phone=phone.digits,  # type: ignore[union-attr]
                fulfillment_type=f["type"],
                delivery_zone_id=zone.id if zone else None,
                zone_name=zone.name if zone else None,
                city=f.get("city") if f["type"] == "shipping" else None,
                address=None if f["type"] == "pickup" else f.get("address"),
                reference=None if f["type"] == "pickup" else f.get("reference"),
                delivery_date=delivery_date,
                payment_method=so["paymentMethod"],
                subtotal_cents=subtotal,
                delivery_fee_cents=fee,
                total_cents=subtotal + (fee or 0),
                reserved_until=reserved_until,
                created_at=created,
                paid_at=paid_at,
                delivered_at=delivered_at,
                cancelled_at=cancelled_at,
                notes=so.get("notes"),
            )
        )
        session.flush()
        session.add_all(items)

        # Movimientos de stock del pedido (SPEC.md, sección 7)
        for item in items:
            if not item.tracks_stock:
                continue

            def event(
                at: datetime, kind: str, reason: str | None, by: str | None, item=item, oid=order_id, num=number
            ) -> StockEvent:
                return StockEvent(at, item.variant_id, kind, item.quantity, reason, by, oid, num)

            events.append(event(created, "reserve", None, None))
            if paid_at is not None:
                events.append(event(paid_at, "sale", None, owner))
            if cancelled_at is not None:
                kind = "release" if paid_at is None else "in"
                events.append(event(cancelled_at, kind, "cancelacion", owner))
            if status == "expired":
                events.append(event(reserved_until, "release", None, None))

    for adjustment in seed.get("adjustments", []):
        _, variant = find_variant(adjustment["product"], adjustment.get("variant"))
        events.append(
            StockEvent(
                now - adjustment["hoursAgo"] * HOUR,
                variant["id"],
                adjustment["type"],
                adjustment["quantity"],
                adjustment["reason"],
                owner,
            )
        )

    # --- Stock inicial: lo justo para terminar con el disponible pedido en los datos ---
    initial_at = now - INITIAL_STOCK_AGO
    for variant_id, wanted in target.items():
        running = lowest = 0
        for e in sorted((e for e in events if e.variant_id == variant_id), key=lambda e: e.at):
            running += AVAILABLE_EFFECT[e.type] * e.amount
            lowest = min(lowest, running)
        initial = wanted - running
        if initial + lowest < 0:
            fail(f"{variant_id}: el stock queda negativo en algún momento")
        if initial > 0:
            events.append(StockEvent(initial_at, variant_id, "in", initial, None, owner))

    # --- Aplicar los movimientos en orden con las reglas del agregado ---
    for n, e in enumerate(sorted(events, key=lambda e: e.at), start=1):
        signed = stock[e.variant_id].apply(MovementType(e.type), e.amount)
        session.add(
            StockMovementModel(
                id=f"mv_{p}_{n}",
                store_id=store_id,
                variant_id=e.variant_id,
                order_id=e.order_id,
                order_number=e.order_number,
                type=e.type,
                quantity=signed,
                reason=e.reason,
                created_by=e.created_by,
                created_at=e.at,
            )
        )

    for variant_id, item in stock.items():
        if item.available != target[variant_id]:
            fail(f"{variant_id}: terminó con {item.available} disponibles y no {target[variant_id]}")
        session.add(
            StockItemModel(
                variant_id=variant_id,
                store_id=store_id,
                on_hand=item.on_hand,
                reserved=item.reserved,
                low_stock_threshold=item.low_stock_threshold,
                version=0,
            )
        )
    session.flush()


def seed(now: datetime | None = None) -> None:
    now = (now or datetime.now(UTC)).replace(second=0, microsecond=0)
    stores = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    tables = ", ".join(table.name for table in reversed(Base.metadata.sorted_tables))
    with Session(get_engine()) as session, session.begin():
        session.execute(text(f"TRUNCATE {tables} CASCADE"))
        for store in stores:
            build_store(session, store, now)


if __name__ == "__main__":
    seed()
    print("Listo: datos de prueba cargados (dulcesdeana, tallernorte, fundalab).")
