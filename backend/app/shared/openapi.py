"""
Algunos endpoints validan su cuerpo a mano para responder con las claves que espera el front.
Aquí se documenta qué reciben, para que /docs lo muestre y la etapa C1 pueda comparar los tipos.
"""

from collections.abc import Callable
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

_models: dict[str, type[BaseModel]] = {}


def json_body(model: type[BaseModel], *, many: bool = False) -> dict[str, Any]:
    """`openapi_extra` de un endpoint cuyo cuerpo es `model` (o una lista de `model`)."""
    _models[model.__name__] = model
    ref = {"$ref": f"#/components/schemas/{model.__name__}"}
    schema = {"type": "array", "items": ref} if many else ref
    return {"requestBody": {"required": True, "content": {"application/json": {"schema": schema}}}}


def add_request_models(app: FastAPI) -> None:
    original: Callable[[], dict[str, Any]] = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = original()
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        for name, model in _models.items():
            definition = model.model_json_schema(by_alias=True, ref_template="#/components/schemas/{model}")
            components.update(definition.pop("$defs", {}))
            components[name] = definition
        return schema

    app.openapi = openapi  # type: ignore[method-assign]
