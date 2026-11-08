"""Esquemas de catalog: coinciden campo por campo con frontend/shared/types/product.ts."""

from pydantic import Field

from app.modules.stores.public import DeliveryZone, Store
from app.shared.schemas import CamelModel


class Category(CamelModel):
    id: str
    name: str
    position: int


class OptionValue(CamelModel):
    id: str
    value: str


class ProductOption(CamelModel):
    id: str
    name: str
    values: list[OptionValue]


class CustomField(CamelModel):
    id: str
    label: str
    required: bool
    max_length: int


class Variant(CamelModel):
    """Variante como la ve el cliente: sin datos internos de stock."""

    id: str
    option_value_ids: list[str] = Field(description="Vacío en la variante por defecto")
    label: str
    price_cents: int
    available: int = Field(description="on_hand - reserved; 99 en productos por encargo")
    low_stock: bool
    active: bool


class Product(CamelModel):
    id: str
    category_id: str | None
    name: str
    description: str
    images: list[str]
    made_to_order: bool
    size_guide_url: str | None
    visible: bool
    position: int
    options: list[ProductOption]
    variants: list[Variant]
    custom_fields: list[CustomField]
    price_from_cents: int


class VariantAdmin(Variant):
    """Variante tal como la ve el dueño en el panel."""

    on_hand: int = Field(description='"En total"')
    reserved: int
    low_stock_threshold: int | None


class ProductAdmin(Product):
    variants: list[VariantAdmin]  # type: ignore[assignment]


class Catalog(CamelModel):
    store: Store
    categories: list[Category]
    products: list[Product] = Field(description="Solo visibles")
    delivery_zones: list[DeliveryZone] = Field(description="Solo activas")


# --- Entradas del panel. Documentan el cuerpo en /docs; la validación real está en admin.py ---


class CategoryInput(CamelModel):
    """Lista completa en orden. Sin id = nueva; las que no vienen se borran."""

    id: str | None = None
    name: str


class OptionValueInput(CamelModel):
    id: str | None = None
    value: str


class ProductOptionInput(CamelModel):
    id: str | None = None
    name: str
    values: list[OptionValueInput]


class VariantInput(CamelModel):
    id: str | None = None
    option_values: list[str] = Field(
        description='["Negro", "M"] en el orden de options; vacío en la variante por defecto'
    )
    price_cents: int
    active: bool
    low_stock_threshold: int | None
    initial_stock: int | None = Field(default=None, description="Solo en variantes nuevas; después, con ajustes")


class CustomFieldInput(CamelModel):
    id: str | None = None
    label: str
    required: bool
    max_length: int


class ProductInput(CamelModel):
    category_id: str | None
    name: str
    description: str
    images: list[str] = Field(description="Máximo 5")
    made_to_order: bool
    size_guide_url: str | None
    visible: bool
    options: list[ProductOptionInput] = Field(description="Máximo 3")
    variants: list[VariantInput] = Field(description="Exactamente una por combinación")
    custom_fields: list[CustomFieldInput]


class ProductVisibilityInput(CamelModel):
    visible: bool


class UploadedImage(CamelModel):
    url: str
