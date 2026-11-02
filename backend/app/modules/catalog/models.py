"""
Tablas de catalog: categorías, productos, fotos, opciones, valores, variantes y campos extra.
Las variantes NO guardan stock: el stock vive en stock_items (inventory).
"""

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base
from app.shared.models import IdColumn, TimestampMixin


class CategoryModel(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    position: Mapped[int] = mapped_column(Integer, default=0)


class ProductModel(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    # Si se borra la categoría, el producto queda sin categoría
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    made_to_order: Mapped[bool] = mapped_column(Boolean, default=False)
    size_guide_url: Mapped[str | None] = mapped_column(Text)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class ProductImageModel(Base):
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)


class ProductOptionModel(Base):
    __tablename__ = "product_options"

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(30))
    position: Mapped[int] = mapped_column(Integer, default=0)


class OptionValueModel(Base):
    __tablename__ = "option_values"

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    option_id: Mapped[str] = mapped_column(ForeignKey("product_options.id", ondelete="CASCADE"), index=True)
    value: Mapped[str] = mapped_column(String(30))
    position: Mapped[int] = mapped_column(Integer, default=0)


class VariantModel(Base):
    __tablename__ = "variants"
    __table_args__ = (CheckConstraint("price_cents >= 0", name="price_positive"),)

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    # "Negro / M"; vacío en la variante por defecto
    label: Mapped[str] = mapped_column(String(100), default="")
    price_cents: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class VariantOptionValueModel(Base):
    __tablename__ = "variant_option_values"
    __table_args__ = (Index("ix_variant_option_values_option_value_id", "option_value_id"),)

    variant_id: Mapped[str] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"), primary_key=True)
    option_value_id: Mapped[str] = mapped_column(ForeignKey("option_values.id", ondelete="CASCADE"), primary_key=True)
    # Orden de la opción dentro del producto (0, 1, 2)
    position: Mapped[int] = mapped_column(Integer, default=0)


class CustomFieldModel(Base):
    __tablename__ = "custom_fields"
    __table_args__ = (CheckConstraint("max_length between 1 and 200", name="max_length_range"),)

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(40))
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    max_length: Mapped[int] = mapped_column(Integer, default=60)
    position: Mapped[int] = mapped_column(Integer, default=0)
