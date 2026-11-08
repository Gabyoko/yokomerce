"""Esquemas de stores: coinciden campo por campo con frontend/shared/types/store.ts."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.shared.schemas import CamelModel

PaymentMethod = Literal["yape", "plin", "cash", "transfer"]
Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class OpeningHours(CamelModel):
    open: str  # "09:00"
    close: str


class StoreFeatures(CamelModel):
    delivery_date: bool
    lead_time_days: int
    made_to_order: bool
    size_guide: bool
    delivery_zones: bool
    pickup: bool
    shipping: bool


class BusinessHours(CamelModel):
    mon: OpeningHours | None
    tue: OpeningHours | None
    wed: OpeningHours | None
    thu: OpeningHours | None
    fri: OpeningHours | None
    sat: OpeningHours | None
    sun: OpeningHours | None


class Store(CamelModel):
    id: str
    slug: str
    name: str
    description: str
    logo_url: str | None
    cover_url: str | None
    city: str
    whatsapp: str = Field(description='Con prefijo: "51912345678"')
    business_hours: BusinessHours
    payment_methods: list[PaymentMethod]
    payment_instructions: str | None
    features: StoreFeatures
    pickup_address: str | None
    shipping_fee_cents: int | None = Field(description='null = envío "a coordinar"')
    reservation_hours: int
    plan: Literal["free", "pro"]
    plan_expires_at: datetime | None


class DeliveryZone(CamelModel):
    id: str
    name: str
    price_cents: int
    active: bool


class SlugAvailability(CamelModel):
    available: bool


# --- Entradas del panel. Documentan el cuerpo en /docs; la validación real está en service.py ---


class StoreAnswers(CamelModel):
    delivery_date: bool = Field(description="¿Tus clientes eligen el día de entrega?")
    made_to_order: bool = Field(description="¿Preparas productos por encargo? (sugiere leadTimeDays = 1)")
    shipping: bool = Field(description="¿Haces envíos fuera de tu ciudad?")


class CreateStoreInput(CamelModel):
    owner_name: str
    name: str
    slug: str
    whatsapp: str = Field(description="Celular de 9 dígitos; la API lo guarda con el prefijo 51")
    city: str
    answers: StoreAnswers


class FeaturesPatch(CamelModel):
    delivery_date: bool | None = None
    lead_time_days: int | None = None
    made_to_order: bool | None = None
    size_guide: bool | None = None
    delivery_zones: bool | None = None
    pickup: bool | None = None
    shipping: bool | None = None


class UpdateStoreInput(CamelModel):
    """Solo los campos que cambian. El link (slug) no se puede cambiar."""

    name: str | None = None
    description: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    city: str | None = None
    whatsapp: str | None = None
    business_hours: BusinessHours | None = None
    payment_methods: list[PaymentMethod] | None = None
    payment_instructions: str | None = None
    pickup_address: str | None = None
    shipping_fee_cents: int | None = None
    reservation_hours: int | None = None
    features: FeaturesPatch | None = None


class ZoneInput(CamelModel):
    """Sin id = zona nueva; las que no vienen en la lista se borran."""

    id: str | None = None
    name: str
    price_cents: int
    active: bool
