"""
Lógica de catalog. El stock lo pide a inventory.public (catalog no lee stock_items).
Las funciones apagadas de la tienda no aparecen: sin "por encargo" el producto es normal,
sin guía de tallas no se muestra la guía.
"""

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.inventory.public import stock_levels
from app.modules.stores.public import Store, active_zones, get_store_by_slug
from app.shared.errors import NotFound

from .models import (
    CategoryModel,
    CustomFieldModel,
    OptionValueModel,
    ProductImageModel,
    ProductModel,
    ProductOptionModel,
    VariantModel,
    VariantOptionValueModel,
)
from .schemas import (
    Catalog,
    Category,
    CustomField,
    OptionValue,
    Product,
    ProductAdmin,
    ProductOption,
    Variant,
    VariantAdmin,
)

# Lo que se informa como disponible en productos por encargo: nunca aparecen agotados (máximo por línea)
MADE_TO_ORDER_AVAILABLE = 99


def is_made_to_order(product: ProductModel, store: Store) -> bool:
    return product.made_to_order and store.features.made_to_order


@dataclass
class _ProductParts:
    images: dict[str, list[str]]
    options: dict[str, list[ProductOption]]
    variants: dict[str, list[VariantModel]]
    value_ids: dict[str, list[str]]
    fields: dict[str, list[CustomField]]


def _load_parts(session: Session, product_ids: list[str]) -> _ProductParts:
    """Carga fotos, opciones, variantes y campos extra de varios productos en pocas consultas."""
    parts = _ProductParts(defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list))
    if not product_ids:
        return parts

    for image in session.scalars(
        select(ProductImageModel)
        .where(ProductImageModel.product_id.in_(product_ids))
        .order_by(ProductImageModel.position)
    ):
        parts.images[image.product_id].append(image.url)

    options = list(
        session.scalars(
            select(ProductOptionModel)
            .where(ProductOptionModel.product_id.in_(product_ids))
            .order_by(ProductOptionModel.position)
        )
    )
    values: dict[str, list[OptionValue]] = defaultdict(list)
    if options:
        for value in session.scalars(
            select(OptionValueModel)
            .where(OptionValueModel.option_id.in_([o.id for o in options]))
            .order_by(OptionValueModel.position)
        ):
            values[value.option_id].append(OptionValue(id=value.id, value=value.value))
    for option in options:
        parts.options[option.product_id].append(ProductOption(id=option.id, name=option.name, values=values[option.id]))

    variants = list(
        session.scalars(
            select(VariantModel).where(VariantModel.product_id.in_(product_ids)).order_by(VariantModel.position)
        )
    )
    for variant in variants:
        parts.variants[variant.product_id].append(variant)
    if variants:
        for link in session.scalars(
            select(VariantOptionValueModel)
            .where(VariantOptionValueModel.variant_id.in_([v.id for v in variants]))
            .order_by(VariantOptionValueModel.position)
        ):
            parts.value_ids[link.variant_id].append(link.option_value_id)

    for field in session.scalars(
        select(CustomFieldModel).where(CustomFieldModel.product_id.in_(product_ids)).order_by(CustomFieldModel.position)
    ):
        parts.fields[field.product_id].append(
            CustomField(id=field.id, label=field.label, required=field.required, max_length=field.max_length)
        )
    return parts


def _price_from(variants: list[VariantAdmin]) -> int:
    """Precio más bajo entre variantes activas (si no hay activas, entre todas)."""
    pool = [v for v in variants if v.active] or variants
    return min((v.price_cents for v in pool), default=0)


def to_products_admin(session: Session, store: Store, products: list[ProductModel]) -> list[ProductAdmin]:
    """Productos como los ve el dueño. Las funciones apagadas de la tienda no aparecen."""
    parts = _load_parts(session, [p.id for p in products])
    stock = stock_levels(session, [v.id for vs in parts.variants.values() for v in vs])
    result = []
    for product in products:
        made_to_order = is_made_to_order(product, store)
        variants = []
        for variant in parts.variants[product.id]:
            level = stock[variant.id]
            available = MADE_TO_ORDER_AVAILABLE if made_to_order else level.available
            threshold = None if made_to_order else level.low_stock_threshold
            variants.append(
                VariantAdmin(
                    id=variant.id,
                    option_value_ids=parts.value_ids[variant.id],
                    label=variant.label,
                    price_cents=variant.price_cents,
                    available=available,
                    low_stock=threshold is not None and available <= threshold,
                    active=variant.active,
                    on_hand=level.on_hand,
                    reserved=level.reserved,
                    low_stock_threshold=level.low_stock_threshold,
                )
            )
        result.append(
            ProductAdmin(
                id=product.id,
                category_id=product.category_id,
                name=product.name,
                description=product.description,
                images=parts.images[product.id],
                made_to_order=made_to_order,
                size_guide_url=product.size_guide_url if store.features.size_guide else None,
                visible=product.visible,
                position=product.position,
                options=parts.options[product.id],
                variants=variants,
                custom_fields=parts.fields[product.id],
                price_from_cents=_price_from(variants),
            )
        )
    return result


def _to_public(product: ProductAdmin) -> Product:
    """Producto como lo ve el cliente: sin datos internos de stock."""
    fields = {name: getattr(product, name) for name in Product.model_fields if name != "variants"}
    variants = [
        Variant(**{name: getattr(variant, name) for name in Variant.model_fields}) for variant in product.variants
    ]
    return Product(**fields, variants=variants)


def to_products(session: Session, store: Store, products: list[ProductModel]) -> list[Product]:
    return [_to_public(product) for product in to_products_admin(session, store, products)]


def get_catalog(session: Session, slug: str) -> Catalog:
    store = get_store_by_slug(session, slug)
    categories = session.scalars(
        select(CategoryModel).where(CategoryModel.store_id == store.id).order_by(CategoryModel.position)
    )
    products = list(
        session.scalars(
            select(ProductModel)
            .where(ProductModel.store_id == store.id, ProductModel.visible)
            .order_by(ProductModel.position)
        )
    )
    return Catalog(
        store=store,
        categories=[Category(id=c.id, name=c.name, position=c.position) for c in categories],
        products=to_products(session, store, products),
        delivery_zones=active_zones(session, store),
    )


def get_public_product(session: Session, slug: str, product_id: str) -> Product:
    """Los productos ocultos no existen para el cliente."""
    store = get_store_by_slug(session, slug)
    product = session.scalar(
        select(ProductModel).where(
            ProductModel.id == product_id, ProductModel.store_id == store.id, ProductModel.visible
        )
    )
    if product is None:
        raise NotFound("Este producto no existe o ya no está disponible.")
    return to_products(session, store, [product])[0]
