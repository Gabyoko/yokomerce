"""Endpoints de stores (SPEC.md, sección 5)."""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, status

from app.modules.iam.public import CurrentUser, get_current_store, get_current_user, rename_user
from app.shared.db import UnitOfWork, get_uow
from app.shared.openapi import json_body
from app.shared.validation import text

from . import service
from .schemas import CreateStoreInput, DeliveryZone, SlugAvailability, Store, UpdateStoreInput, ZoneInput

router = APIRouter(tags=["tiendas"])

Uow = Annotated[UnitOfWork, Depends(get_uow)]
MyStore = Annotated[Store, Depends(get_current_store)]


@router.get("/public/slugs/{slug}", response_model=SlugAvailability, summary="¿Está libre este link de tienda?")
def check_slug(slug: str, uow: Uow) -> SlugAvailability:
    return service.check_slug(uow.session, slug)


@router.get("/me/store", response_model=Store, summary="Mi tienda")
def get_my_store(store: MyStore) -> Store:
    return store


@router.post(
    "/me/store",
    status_code=status.HTTP_201_CREATED,
    response_model=Store,
    summary="Registrar mi tienda",
    openapi_extra=json_body(CreateStoreInput),
)
def create_my_store(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    uow: Uow,
    body: Annotated[Any, Body()] = None,
) -> Store:
    model = service.create_store(uow.session, user.id, body)
    rename_user(uow.session, user.id, text(body.get("ownerName")))
    store = service.to_store(uow.session, model)
    uow.commit()
    return store


@router.patch(
    "/me/store",
    response_model=Store,
    summary="Cambiar los datos de mi tienda",
    openapi_extra=json_body(UpdateStoreInput),
)
def update_my_store(store: MyStore, uow: Uow, body: Annotated[Any, Body()] = None) -> Store:
    model = service.update_store(uow.session, store.id, body)
    updated = service.to_store(uow.session, model)
    uow.commit()
    return updated


@router.get("/me/zones", response_model=list[DeliveryZone], summary="Mis zonas de delivery (también las desactivadas)")
def get_my_zones(store: MyStore, uow: Uow) -> list[DeliveryZone]:
    return service.zones_of(uow.session, store.id, only_active=False)


@router.put(
    "/me/zones",
    response_model=list[DeliveryZone],
    summary="Guardar la lista completa de zonas",
    openapi_extra=json_body(ZoneInput, many=True),
)
def save_my_zones(store: MyStore, uow: Uow, body: Annotated[Any, Body()] = None) -> list[DeliveryZone]:
    zones = service.save_zones(uow.session, store.id, body)
    uow.commit()
    return zones
