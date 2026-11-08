"""Endpoints de catalog (SPEC.md, sección 5)."""

from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, File, Request, UploadFile, status

from app.modules.iam.public import CurrentUser, get_current_store, get_current_user
from app.modules.stores.public import Store
from app.shared.db import UnitOfWork, get_uow
from app.shared.domain.time import utc_now
from app.shared.errors import ValidationFailed
from app.shared.openapi import json_body

from . import admin, service
from .images import MAX_BYTES, ImageStorage, get_storage, save_image
from .schemas import (
    Catalog,
    Category,
    CategoryInput,
    Product,
    ProductAdmin,
    ProductInput,
    ProductVisibilityInput,
    UploadedImage,
)

router = APIRouter(tags=["catálogo"])


@router.get("/public/stores/{slug}", response_model=Catalog, summary="Catálogo de una tienda")
def get_catalog(slug: str, uow: Annotated[UnitOfWork, Depends(get_uow)]) -> Catalog:
    return service.get_catalog(uow.session, slug)


@router.get("/public/stores/{slug}/products/{product_id}", response_model=Product, summary="Detalle de un producto")
def get_product(slug: str, product_id: str, uow: Annotated[UnitOfWork, Depends(get_uow)]) -> Product:
    return service.get_public_product(uow.session, slug, product_id)


# --- Panel ---

Uow = Annotated[UnitOfWork, Depends(get_uow)]
MyStore = Annotated[Store, Depends(get_current_store)]
Me = Annotated[CurrentUser, Depends(get_current_user)]
Payload = Annotated[Any, Body()]


@router.get("/me/categories", response_model=list[Category], summary="Mis categorías")
def get_my_categories(store: MyStore, uow: Uow) -> list[Category]:
    return admin.list_categories(uow.session, store)


@router.put(
    "/me/categories",
    response_model=list[Category],
    summary="Guardar la lista completa de categorías",
    openapi_extra=json_body(CategoryInput, many=True),
)
def save_my_categories(store: MyStore, uow: Uow, body: Payload = None) -> list[Category]:
    categories = admin.save_categories(uow.session, store, body)
    uow.commit()
    return categories


@router.get("/me/products", response_model=list[ProductAdmin], summary="Mis productos (también los ocultos)")
def get_my_products(store: MyStore, uow: Uow) -> list[ProductAdmin]:
    return admin.list_products(uow.session, store)


@router.post(
    "/me/products",
    status_code=status.HTTP_201_CREATED,
    response_model=ProductAdmin,
    summary="Crear un producto",
    openapi_extra=json_body(ProductInput),
)
def create_my_product(store: MyStore, user: Me, uow: Uow, body: Payload = None) -> ProductAdmin:
    now = utc_now().replace(microsecond=0)
    product = admin.create_product(uow.session, store, body, user.name, now)
    uow.commit()
    return product


@router.get("/me/products/{product_id}", response_model=ProductAdmin, summary="Uno de mis productos")
def get_my_product(product_id: str, store: MyStore, uow: Uow) -> ProductAdmin:
    return admin.get_product_admin(uow.session, store, product_id)


@router.put(
    "/me/products/{product_id}",
    response_model=ProductAdmin,
    summary="Editar un producto",
    openapi_extra=json_body(ProductInput),
)
def update_my_product(product_id: str, store: MyStore, user: Me, uow: Uow, body: Payload = None) -> ProductAdmin:
    now = utc_now().replace(microsecond=0)
    product = admin.update_product(uow.session, store, product_id, body, user.name, now)
    uow.commit()
    return product


@router.patch(
    "/me/products/{product_id}",
    response_model=ProductAdmin,
    summary="Mostrar u ocultar un producto",
    openapi_extra=json_body(ProductVisibilityInput),
)
def set_my_product_visible(product_id: str, store: MyStore, uow: Uow, body: Payload = None) -> ProductAdmin:
    product = admin.set_product_visible(uow.session, store, product_id, body)
    uow.commit()
    return product


@router.post(
    "/me/uploads",
    status_code=status.HTTP_201_CREATED,
    response_model=UploadedImage,
    summary="Subir una foto (JPG, PNG o WebP, máximo 5 MB)",
)
def upload_image(
    request: Request,
    store: MyStore,
    storage: Annotated[ImageStorage, Depends(get_storage)],
    file: Annotated[UploadFile | None, File(description="La foto, ya comprimida por el navegador")] = None,
) -> UploadedImage:
    # Corta antes de leer si el cuerpo es claramente demasiado grande (con margen para el formulario)
    if int(request.headers.get("content-length") or 0) > MAX_BYTES + 64 * 1024:
        raise ValidationFailed("La imagen pesa más de 5 MB.", fields={"file": "Máximo 5 MB."})
    if file is None:
        raise ValidationFailed("Adjunta una imagen.", fields={"file": "Adjunta una imagen."})
    return UploadedImage(url=save_image(storage, store.id, file.file))
