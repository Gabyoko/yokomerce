"""Esquemas de inventory: coinciden campo por campo con frontend/shared/types/stock.ts."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.modules.catalog.public import VariantAdmin
from app.shared.schemas import CamelModel


class StockAdjustmentInput(CamelModel):
    type: Literal["in", "out", "adjust"] = Field(description="adjust = fijar el total exacto")
    quantity: int
    reason: str


class StockMovement(CamelModel):
    id: str
    variant_id: str
    type: Literal["reserve", "release", "sale", "in", "out", "adjust"]
    quantity: int = Field(description="Positivo o negativo según el efecto")
    reason: str | None
    order_number: int | None
    created_by: str | None = Field(description="null = automático")
    created_at: datetime


class StockAdjustmentResult(CamelModel):
    movement: StockMovement
    variant: VariantAdmin
