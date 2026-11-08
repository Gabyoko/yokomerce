"""API pública de stores: lo único que otros módulos pueden usar."""

from sqlalchemy.orm import Session

from . import service
from .schemas import DeliveryZone, Store, StoreFeatures

__all__ = [
    "DeliveryZone",
    "Store",
    "StoreFeatures",
    "active_zones",
    "get_store_by_slug",
    "get_store_of_member",
    "take_order_number",
]


def get_store_by_slug(session: Session, slug: str) -> Store:
    """Tienda activa por su link. Lanza NotFound si no existe."""
    return service.to_store(session, service.find_store_by_slug(session, slug))


def get_store_of_member(session: Session, user_id: str) -> Store | None:
    """La tienda activa de un usuario, o None si todavía no tiene."""
    model = service.find_store_of_member(session, user_id)
    return None if model is None else service.to_store(session, model)


def active_zones(session: Session, store: Store) -> list[DeliveryZone]:
    """Zonas activas, solo si la tienda usa delivery por zonas."""
    if not store.features.delivery_zones:
        return []
    return service.zones_of(session, store.id, only_active=True)


def take_order_number(session: Session, store_id: str) -> int:
    return service.take_order_number(session, store_id)
