"""
Productos y categorías del panel (SPEC.md, sección 5, "Reglas del panel").
Al editar se conservan los ids de opciones, valores y variantes que ya existen; el stock de una variante
existente solo cambia con ajustes, y no se puede quitar una variante con unidades reservadas.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.modules.inventory.public import create_stock, set_low_stock_threshold, stock_levels
from app.modules.stores.public import Store
from app.modules.subscriptions.public import product_limit
from app.shared.domain.ids import new_id
from app.shared.errors import Conflict, LimitReached, NotFound, ValidationFailed
from app.shared.validation import FieldErrors, is_int, is_object, text

from .domain.variants import combination_key, combinations
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
from .schemas import Category, ProductAdmin
from .service import to_products_admin

LIMITS = {
    "name": 80,
    "description": 1000,
    "images": 5,
    "options": 3,
    "option_name": 30,
    "option_value": 30,
    "values_per_option": 30,
    "custom_fields": 5,
    "field_label": 40,
    "field_max_length": 200,
    "category": 40,
    "stock": 99_999,
    "price_cents": 10_000_000,
}


def _same(a: str, b: str) -> bool:
    return a.lower() == b.lower()


def _str_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) else None


# --- Categorías ---


def _categories_of(session: Session, store_id: str) -> list[CategoryModel]:
    return list(
        session.scalars(
            select(CategoryModel).where(CategoryModel.store_id == store_id).order_by(CategoryModel.position)
        )
    )


def list_categories(session: Session, store: Store) -> list[Category]:
    return [Category(id=c.id, name=c.name, position=c.position) for c in _categories_of(session, store.id)]


def save_categories(session: Session, store: Store, body: Any) -> list[Category]:
    """Lista completa en orden. Los productos de una categoría borrada quedan sin categoría (lo hace la base)."""
    if not isinstance(body, list):
        raise ValidationFailed("La lista de categorías no es válida.")
    current = {c.id: c for c in _categories_of(session, store.id)}
    errors = FieldErrors()
    seen: list[str] = []
    used_ids: set[str] = set()
    parsed: list[tuple[str | None, str]] = []
    for position, raw in enumerate(body):
        category = raw if is_object(raw) else {}
        name = text(category.get("name"))
        if not name or len(name) > LIMITS["category"]:
            errors.add(f"{position}.name", "Escribe el nombre de la categoría.")
        elif any(_same(other, name) for other in seen):
            errors.add(f"{position}.name", "Esta categoría está repetida.")
        seen.append(name)
        category_id = category.get("id")
        if category_id is not None and (category_id not in current or category_id in used_ids):
            errors.add(f"{position}.id", "Esta categoría no existe.")
        if category_id is not None:
            used_ids.add(category_id)
        parsed.append((category_id, name))
    errors.throw_if_any("Revisa las categorías.")

    removed = set(current) - used_ids
    if removed:
        session.execute(delete(CategoryModel).where(CategoryModel.id.in_(removed)))
    for position, (category_id, name) in enumerate(parsed):
        if category_id is None:
            session.add(CategoryModel(id=new_id("ct"), store_id=store.id, name=name, position=position))
        else:
            row = current[category_id]
            row.name, row.position = name, position
    session.flush()
    return list_categories(session, store)


# --- Leer productos ---


def list_products(session: Session, store: Store) -> list[ProductAdmin]:
    """Todos, también los ocultos."""
    rows = session.scalars(
        select(ProductModel).where(ProductModel.store_id == store.id).order_by(ProductModel.position)
    )
    return to_products_admin(session, store, list(rows))


def _find_own_product(session: Session, store: Store, product_id: str, *, lock: bool = False) -> ProductModel:
    query = select(ProductModel).where(ProductModel.id == product_id, ProductModel.store_id == store.id)
    product = session.scalar(query.with_for_update() if lock else query)
    if product is None:
        raise NotFound("No encontramos este producto.")
    return product


def get_product_admin(session: Session, store: Store, product_id: str) -> ProductAdmin:
    return to_products_admin(session, store, [_find_own_product(session, store, product_id)])[0]


# --- Validar lo que manda el panel ---


@dataclass
class _Option:
    id: str | None
    name: str
    values: list[tuple[str | None, str]]


@dataclass
class _Field:
    id: str | None
    label: str
    required: bool
    max_length: int


@dataclass
class _Variant:
    id: str | None
    values: list[str]
    price_cents: int
    active: bool
    low_stock_threshold: int | None
    initial_stock: int


@dataclass
class _Parsed:
    category_id: str | None
    name: str
    description: str
    images: list[str]
    made_to_order: bool
    size_guide_url: str | None
    visible: bool
    options: list[_Option]
    variants: list[_Variant]
    custom_fields: list[_Field]


def _parse(session: Session, store: Store, body: Any) -> _Parsed:
    """Valida un ProductInput. Las funciones apagadas de la tienda se rechazan."""
    data = body if is_object(body) else {}
    errors = FieldErrors()

    name = text(data.get("name"))
    if not 2 <= len(name) <= LIMITS["name"]:
        errors.add("name", "Escribe el nombre del producto (de 2 a 80 letras).")
    description = text(data.get("description"))
    if len(description) > LIMITS["description"]:
        errors.add("description", "Máximo 1000 letras.")

    raw_images = data.get("images")
    images = [text(url) for url in raw_images] if isinstance(raw_images, list) else []
    if not isinstance(raw_images, list) or any(not url for url in images):
        errors.add("images", "Las fotos no son válidas.")
    elif len(images) > LIMITS["images"]:
        errors.add("images", f"Máximo {LIMITS['images']} fotos.")

    category_id = None if data.get("categoryId") is None else text(data.get("categoryId"))
    if category_id:
        # Solo categorías de esta tienda
        found = session.scalar(
            select(CategoryModel.id).where(CategoryModel.id == category_id, CategoryModel.store_id == store.id)
        )
        if found is None:
            errors.add("categoryId", "Elige una categoría de tu tienda.")

    made_to_order = data.get("madeToOrder") is True
    if made_to_order and not store.features.made_to_order:
        errors.add("madeToOrder", "Activa los pedidos por encargo en Configuración.")
    size_guide_url = None if data.get("sizeGuideUrl") is None else (text(data.get("sizeGuideUrl")) or None)
    if size_guide_url and not store.features.size_guide:
        errors.add("sizeGuideUrl", "Activa la guía de tallas en Configuración.")
    visible = data.get("visible") is not False

    # Opciones
    raw_options = data.get("options") if isinstance(data.get("options"), list) else []
    if len(raw_options) > LIMITS["options"]:
        errors.add("options", f"Máximo {LIMITS['options']} opciones por producto.")
    options: list[_Option] = []
    for i, raw in enumerate(raw_options):
        option = raw if is_object(raw) else {}
        option_name = text(option.get("name"))
        if not option_name or len(option_name) > LIMITS["option_name"]:
            errors.add(f"options.{i}.name", "Escribe el nombre de la opción.")
        raw_values = option.get("values") if isinstance(option.get("values"), list) else []
        if not raw_values:
            errors.add(f"options.{i}.values", "Agrega al menos un valor.")
        if len(raw_values) > LIMITS["values_per_option"]:
            errors.add(f"options.{i}.values", "Demasiados valores.")
        values: list[tuple[str | None, str]] = []
        for j, raw_value in enumerate(raw_values):
            entry = raw_value if is_object(raw_value) else {}
            value = text(entry.get("value"))
            if not value or len(value) > LIMITS["option_value"]:
                errors.add(f"options.{i}.values.{j}", "Escribe el valor.")
            values.append((_str_or_none(entry.get("id")), value))
        if len({value.lower() for _, value in values}) != len(values):
            errors.add(f"options.{i}.values", "Hay valores repetidos.")
        options.append(_Option(_str_or_none(option.get("id")), option_name, values))
    if len({o.name.lower() for o in options}) != len(options):
        errors.add("options", "Hay opciones repetidas.")

    # Campos extra
    raw_fields = data.get("customFields") if isinstance(data.get("customFields"), list) else []
    if len(raw_fields) > LIMITS["custom_fields"]:
        errors.add("customFields", f"Máximo {LIMITS['custom_fields']} campos extra.")
    fields: list[_Field] = []
    for i, raw in enumerate(raw_fields):
        field = raw if is_object(raw) else {}
        label = text(field.get("label"))
        if not label or len(label) > LIMITS["field_label"]:
            errors.add(f"customFields.{i}.label", "Escribe el nombre del campo.")
        max_length = 60 if field.get("maxLength") is None else field.get("maxLength")
        if not is_int(max_length, 1, LIMITS["field_max_length"]):
            errors.add(f"customFields.{i}.maxLength", "Escribe un máximo de 1 a 200 letras.")
        fields.append(_Field(_str_or_none(field.get("id")), label, field.get("required") is True, max_length))
    if len({f.label.lower() for f in fields}) != len(fields):
        errors.add("customFields", "Hay campos repetidos.")

    # Variantes: exactamente una por combinación
    raw_variants = data.get("variants") if isinstance(data.get("variants"), list) else []
    variants: list[_Variant] = []
    for i, raw in enumerate(raw_variants):
        variant = raw if is_object(raw) else {}
        raw_option_values = variant.get("optionValues")
        option_values = [text(v) for v in raw_option_values] if isinstance(raw_option_values, list) else []
        if not is_int(variant.get("priceCents"), 0, LIMITS["price_cents"]):
            errors.add(f"variants.{i}.priceCents", "Escribe un precio válido.")
        threshold = variant.get("lowStockThreshold")
        if threshold is not None and not is_int(threshold, 0, LIMITS["stock"]):
            errors.add(f"variants.{i}.lowStockThreshold", "Escribe un número válido.")
        initial = 0 if variant.get("initialStock") is None else variant.get("initialStock")
        if not is_int(initial, 0, LIMITS["stock"]):
            errors.add(f"variants.{i}.initialStock", "Escribe una cantidad válida.")
        variants.append(
            _Variant(
                _str_or_none(variant.get("id")),
                option_values,
                variant.get("priceCents"),
                variant.get("active") is not False,
                threshold,
                initial,
            )
        )

    expected = {combination_key(c) for c in combinations([[value for _, value in o.values] for o in options])}
    given = [combination_key(v.values) for v in variants]
    if len(given) != len(expected) or len(set(given)) != len(given) or any(key not in expected for key in given):
        errors.add("variants", "Debe haber exactamente una variante por cada combinación de opciones.")

    errors.throw_if_any("Revisa los datos del producto.")
    return _Parsed(
        category_id=category_id or None,
        name=name,
        description=description,
        images=images,
        made_to_order=made_to_order,
        size_guide_url=size_guide_url,
        visible=visible,
        options=options,
        variants=variants,
        custom_fields=fields,
    )


# --- Guardar ---


def _pick(rows: list[Any], used: set[str], wanted_id: str | None, matches: Any) -> Any | None:
    """La fila que corresponde: por id o, si no, por nombre. Cada fila se usa una sola vez."""
    free = [row for row in rows if row.id not in used]
    found = next((row for row in free if row.id == wanted_id), None) or next(
        (row for row in free if matches(row)), None
    )
    if found is not None:
        used.add(found.id)
    return found


def _save_options(session: Session, product_id: str, options: list[_Option]) -> list[dict[str, str]]:
    """Guarda opciones y valores conservando sus ids. Devuelve, por opción, {valor en minúsculas: id}."""
    current = list(session.scalars(select(ProductOptionModel).where(ProductOptionModel.product_id == product_id)))
    used_options: set[str] = set()
    result: list[dict[str, str]] = []
    kept: list[tuple[ProductOptionModel, _Option]] = []
    for position, option in enumerate(options):
        row = _pick(current, used_options, option.id, lambda r, o=option: _same(r.name, o.name))
        if row is None:
            row = ProductOptionModel(id=new_id("op"), product_id=product_id, name=option.name, position=position)
            session.add(row)
        else:
            row.name, row.position = option.name, position
        kept.append((row, option))
    gone = [row.id for row in current if row.id not in used_options]
    if gone:
        session.execute(delete(ProductOptionModel).where(ProductOptionModel.id.in_(gone)))
    session.flush()

    for row, option in kept:
        values = list(session.scalars(select(OptionValueModel).where(OptionValueModel.option_id == row.id)))
        used_values: set[str] = set()
        ids: dict[str, str] = {}
        for position, (value_id, value) in enumerate(option.values):
            value_row = _pick(values, used_values, value_id, lambda r, v=value: _same(r.value, v))
            if value_row is None:
                value_row = OptionValueModel(id=new_id("ov"), option_id=row.id, value=value, position=position)
                session.add(value_row)
            else:
                value_row.value, value_row.position = value, position
            ids[value.lower()] = value_row.id
        gone_values = [r.id for r in values if r.id not in used_values]
        if gone_values:
            session.execute(delete(OptionValueModel).where(OptionValueModel.id.in_(gone_values)))
        session.flush()
        result.append(ids)
    return result


def _save_fields(session: Session, product_id: str, fields: list[_Field]) -> None:
    current = list(session.scalars(select(CustomFieldModel).where(CustomFieldModel.product_id == product_id)))
    used: set[str] = set()
    for position, field in enumerate(fields):
        row = _pick(current, used, field.id, lambda r, f=field: _same(r.label, f.label))
        if row is None:
            session.add(
                CustomFieldModel(
                    id=new_id("cf"),
                    product_id=product_id,
                    label=field.label,
                    required=field.required,
                    max_length=field.max_length,
                    position=position,
                )
            )
        else:
            row.label, row.required, row.max_length, row.position = (
                field.label,
                field.required,
                field.max_length,
                position,
            )
    gone = [row.id for row in current if row.id not in used]
    if gone:
        session.execute(delete(CustomFieldModel).where(CustomFieldModel.id.in_(gone)))


def _apply(session: Session, store: Store, product: ProductModel, parsed: _Parsed, actor: str, now: datetime) -> None:
    # Las variantes actuales y sus valores se leen antes de tocar las opciones
    current = list(session.scalars(select(VariantModel).where(VariantModel.product_id == product.id)))
    links: dict[str, list[str]] = {variant.id: [] for variant in current}
    if current:
        for link in session.scalars(
            select(VariantOptionValueModel)
            .where(VariantOptionValueModel.variant_id.in_(list(links)))
            .order_by(VariantOptionValueModel.position)
        ):
            links[link.variant_id].append(link.option_value_id)

    product.category_id = parsed.category_id
    product.name = parsed.name
    product.description = parsed.description
    product.made_to_order = parsed.made_to_order
    product.size_guide_url = parsed.size_guide_url
    product.visible = parsed.visible
    session.flush()

    session.execute(delete(ProductImageModel).where(ProductImageModel.product_id == product.id))
    for position, url in enumerate(parsed.images):
        session.add(ProductImageModel(id=new_id("pi"), product_id=product.id, url=url, position=position))

    # Primero se decide qué variante queda: necesita los ids de los valores, que se calculan al guardar opciones
    value_ids = _save_options(session, product.id, parsed.options)
    _save_fields(session, product.id, parsed.custom_fields)

    used: set[str] = set()
    matched: list[tuple[_Variant, list[str], VariantModel | None]] = []
    for variant in parsed.variants:
        ids = [value_ids[index][value.lower()] for index, value in enumerate(variant.values)]
        row = _pick(current, used, variant.id, lambda r, wanted=ids: links.get(r.id) == wanted)
        matched.append((variant, ids, row))

    # Quitar una variante con unidades reservadas dejaría pedidos sin stock. El bloqueo evita que se reserve justo ahora
    removed = [row for row in current if row.id not in used]
    if removed:
        levels = stock_levels(session, [row.id for row in removed], lock=True)
        for row in removed:
            reserved = levels[row.id].reserved
            if reserved > 0:
                raise Conflict(
                    f'No puedes quitar "{row.label or product.name}": tiene {reserved} reservados en pedidos nuevos.',
                    code="variant_reserved",
                )
        session.execute(delete(VariantModel).where(VariantModel.id.in_([row.id for row in removed])))

    # Los enlaces variante-valor se vuelven a escribir
    kept = [row.id for _, _, row in matched if row is not None]
    if kept:
        session.execute(delete(VariantOptionValueModel).where(VariantOptionValueModel.variant_id.in_(kept)))

    for position, (variant, ids, row) in enumerate(matched):
        label = " / ".join(variant.values)
        if row is not None:
            row.label, row.price_cents, row.active, row.position = label, variant.price_cents, variant.active, position
            set_low_stock_threshold(session, row.id, variant.low_stock_threshold)
        else:
            row = VariantModel(
                id=new_id("va"),
                store_id=store.id,
                product_id=product.id,
                label=label,
                price_cents=variant.price_cents,
                active=variant.active,
                position=position,
            )
            session.add(row)
            session.flush()
            create_stock(
                session,
                store_id=store.id,
                variant_id=row.id,
                low_stock_threshold=variant.low_stock_threshold,
                initial_stock=0 if parsed.made_to_order else variant.initial_stock,
                actor=actor,
                now=now,
            )
        session.flush()
        for option_position, value_id in enumerate(ids):
            session.add(VariantOptionValueModel(variant_id=row.id, option_value_id=value_id, position=option_position))
    session.flush()


def create_product(session: Session, store: Store, body: Any, actor: str, now: datetime) -> ProductAdmin:
    count = session.scalar(select(func.count()).select_from(ProductModel).where(ProductModel.store_id == store.id)) or 0
    limit = product_limit(store.plan, store.plan_expires_at)
    if limit is not None and count >= limit:
        raise LimitReached(f"Tu plan permite hasta {limit} productos. Mejora a Pro para agregar más.")

    parsed = _parse(session, store, body)
    last = session.scalar(select(func.max(ProductModel.position)).where(ProductModel.store_id == store.id))
    product = ProductModel(
        id=new_id("pr"),
        store_id=store.id,
        name=parsed.name,
        description=parsed.description,
        made_to_order=parsed.made_to_order,
        visible=parsed.visible,
        position=(-1 if last is None else last) + 1,
    )
    session.add(product)
    session.flush()
    _apply(session, store, product, parsed, actor, now)
    return to_products_admin(session, store, [product])[0]


def update_product(
    session: Session, store: Store, product_id: str, body: Any, actor: str, now: datetime
) -> ProductAdmin:
    """Reemplaza el producto. El stock de las variantes que ya existen no cambia aquí."""
    product = _find_own_product(session, store, product_id, lock=True)
    parsed = _parse(session, store, body)
    _apply(session, store, product, parsed, actor, now)
    return to_products_admin(session, store, [product])[0]


def set_product_visible(session: Session, store: Store, product_id: str, body: Any) -> ProductAdmin:
    product = _find_own_product(session, store, product_id, lock=True)
    if not is_object(body) or not isinstance(body.get("visible"), bool):
        raise ValidationFailed("Indica si el producto es visible.", fields={"visible": "Debe ser sí o no."})
    product.visible = body["visible"]
    session.flush()
    return to_products_admin(session, store, [product])[0]
