"""
Errores del negocio. Python puro: el dominio también los usa.
app/shared/error_handlers.py los convierte en { "error": "codigo", "message": "texto", ...extra }
con el código HTTP de SPEC.md, sección 5: 400 validación, 401 sin sesión, 403 sin permiso,
404 no existe, 409 conflicto, 429 demasiadas peticiones.
"""

from typing import Any


class DomainError(Exception):
    """Error esperado del negocio. `extra` se agrega al cuerpo (ej. `fields`, `items`)."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, **extra: Any) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.extra = extra


class ValidationFailed(DomainError):
    """Datos inválidos. `fields` usa las claves del input: {"customer.phone": "..."}."""

    status_code = 400
    code = "validation"

    def __init__(self, message: str = "Revisa los datos.", fields: dict[str, str] | None = None, **extra: Any) -> None:
        super().__init__(message, fields=fields or {}, **extra)


class Unauthorized(DomainError):
    status_code = 401
    code = "unauthorized"


class Forbidden(DomainError):
    status_code = 403
    code = "forbidden"


class LimitReached(DomainError):
    """Límite del plan (ej. `plan_limit`, `plan_required`)."""

    status_code = 403
    code = "plan_limit"


class NotFound(DomainError):
    status_code = 404
    code = "not_found"

    def __init__(self, message: str = "No encontramos lo que buscas.", **extra: Any) -> None:
        super().__init__(message, **extra)


class Conflict(DomainError):
    """Conflicto de estado o de stock. El código lo da quien lo lanza (ej. `variant_reserved`)."""

    status_code = 409
    code = "conflict"


class InvalidTransition(Conflict):
    code = "invalid_status"


class OutOfStock(Conflict):
    """Sin stock suficiente. `items`: [{"variantId": ..., "available": ...}]."""

    code = "out_of_stock"


class RateLimited(DomainError):
    status_code = 429
    code = "rate_limited"


class ServiceUnavailable(DomainError):
    """Falla un servicio del que dependemos; el usuario puede reintentar."""

    status_code = 503
    code = "unavailable"
