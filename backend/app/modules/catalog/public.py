"""API pública de catalog: lo único que otros módulos pueden usar."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.stores.public import Store

from .models import CustomFieldModel, ProductModel, VariantModel
from .schemas import VariantAdmin
from .service import is_made_to_order, to_products_admin

__all__ = [
    "OrderField",
    "OrderableVariant",
    "VariantAdmin",
    "VariantRef",
    "find_variant_of_store",
    "get_variant_admin",
    "list_products_admin",
    "variants_for_order",
]


@dataclass(frozen=True)
class OrderField:
    label: str
    required: bool
    max_length: int


@dataclass(frozen=True)
class OrderableVariant:
    """Lo que un pedido necesita de una variante: precio y datos tomados de lo guardado, nunca del navegador."""

    variant_id: str
    product_name: str
    variant_label: str
    price_cents: int
    # Se puede pedir: producto visible y variante activa
    orderable: bool
    # Por encargo (con la función activa): no reserva ni descuenta stock
    made_to_order: bool
    custom_fields: tuple[OrderField, ...]


def variants_for_order(session: Session, store: Store, variant_ids: list[str]) -> dict[str, OrderableVariant]:
    """Variantes de esta tienda. Las que no existen o son de otra tienda no vienen en el resultado."""
    if not variant_ids:
        return {}
    rows = session.execute(
        select(VariantModel, ProductModel)
        .join(ProductModel, ProductModel.id == VariantModel.product_id)
        .where(VariantModel.id.in_(variant_ids), VariantModel.store_id == store.id)
    ).all()
    product_ids = list({product.id for _, product in rows})
    fields: dict[str, list[OrderField]] = {pid: [] for pid in product_ids}
    for field in session.scalars(
        select(CustomFieldModel).where(CustomFieldModel.product_id.in_(product_ids)).order_by(CustomFieldModel.position)
    ):
        fields[field.product_id].append(OrderField(field.label, field.required, field.max_length))
    return {
        variant.id: OrderableVariant(
            variant_id=variant.id,
            product_name=product.name,
            variant_label=variant.label,
            price_cents=variant.price_cents,
            orderable=product.visible and variant.active,
            made_to_order=is_made_to_order(product, store),
            custom_fields=tuple(fields[product.id]),
        )
        for variant, product in rows
    }


@dataclass(frozen=True)
class VariantRef:
    variant_id: str
    product_id: str
    made_to_order: bool


def find_variant_of_store(session: Session, store: Store, variant_id: str) -> VariantRef | None:
    """La variante, solo si es de esta tienda."""
    row = session.execute(
        select(VariantModel, ProductModel)
        .join(ProductModel, ProductModel.id == VariantModel.product_id)
        .where(VariantModel.id == variant_id, VariantModel.store_id == store.id)
    ).first()
    if row is None:
        return None
    variant, product = row
    return VariantRef(variant.id, product.id, is_made_to_order(product, store))


def get_variant_admin(session: Session, store: Store, variant_id: str) -> VariantAdmin:
    """Variante con su stock actual, como la ve el dueño. Debe existir en esta tienda."""
    ref = find_variant_of_store(session, store, variant_id)
    product = session.get(ProductModel, ref.product_id)
    admin = to_products_admin(session, store, [product])[0]
    return next(variant for variant in admin.variants if variant.id == variant_id)


def list_products_admin(session: Session, store: Store) -> list:
    """Todos los productos de la tienda, también los ocultos (para las métricas)."""
    rows = session.scalars(select(ProductModel).where(ProductModel.store_id == store.id))
    return to_products_admin(session, store, list(rows))
