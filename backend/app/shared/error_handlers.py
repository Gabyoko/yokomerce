"""Convierte los errores en respuestas { error, message, ...extra } (SPEC.md, sección 5)."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.shared.errors import DomainError

logger = logging.getLogger(__name__)


def error_body(code: str, message: str, **extra: Any) -> dict[str, Any]:
    return {"error": code, "message": message, **extra}


def _field_key(location: tuple[int | str, ...]) -> str:
    """("body", "customer", "phone") → "customer.phone" (camelCase, como el input)."""
    parts = [
        str(part) if isinstance(part, int) else to_camel(part)
        for part in location
        if part not in ("body", "query", "path")
    ]
    return ".".join(parts) or "body"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message, **exc.extra), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for error in exc.errors():
            fields.setdefault(_field_key(tuple(error.get("loc", ()))), error.get("msg", "Valor inválido."))
        return JSONResponse(error_body("validation", "Revisa los datos enviados.", fields=fields), status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            429: "rate_limited",
        }
        message = exc.detail if isinstance(exc.detail, str) else "Algo salió mal."
        if exc.status_code == 404 and message == "Not Found":
            message = "No encontramos lo que buscas."
        return JSONResponse(error_body(codes.get(exc.status_code, "http_error"), message), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Error inesperado", exc_info=exc)
        return JSONResponse(error_body("internal", "Algo salió mal. Inténtalo otra vez."), status_code=500)
