"""
Dependencias de sesión para los routers. Todos los endpoints /me/* usan get_current_store() y toda
consulta filtra por esa tienda (SPEC.md, sección 12). La tienda sale siempre de la sesión,
nunca de algo que mande el navegador: por eso un dueño no puede pedir datos de otra tienda.
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.modules.stores.public import Store, get_store_of_member
from app.shared.db import UnitOfWork, get_uow
from app.shared.errors import NotFound, Unauthorized

from .service import CurrentUser, get_or_create_user
from .tokens import INVALID_SESSION, verify_token

# auto_error=False: la falta de token responde con nuestro formato { error, message }
_bearer = HTTPBearer(auto_error=False, description="Token de sesión de Supabase (o de dev_token.py en desarrollo)")


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    uow: Annotated[UnitOfWork, Depends(get_uow)],
) -> CurrentUser:
    if credentials is None:
        raise Unauthorized(INVALID_SESSION)
    return get_or_create_user(uow.session, verify_token(credentials.credentials))


def get_current_store(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    uow: Annotated[UnitOfWork, Depends(get_uow)],
) -> Store:
    store = get_store_of_member(uow.session, user.id)
    if store is None:
        # El front lleva al registro: la sesión es válida, pero todavía no crea su tienda
        raise NotFound("Todavía no tienes una tienda.", code="no_store")
    return store
