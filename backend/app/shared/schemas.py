"""Base de todos los esquemas del contrato (SPEC.md, sección 4)."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """
    En Python se escribe `price_cents`; en el JSON sale y se recibe `priceCents`.
    Acepta también el nombre en Python al construir objetos en el código.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
