"""
Registra los modelos de todos los módulos en Base.metadata (lo usan Alembic y seed.py).
Importa solo modelos: no es una puerta para que un módulo use las tablas de otro.
"""

from app.modules.catalog import models as catalog_models
from app.modules.iam import models as iam_models
from app.modules.inventory.infrastructure import models as inventory_models
from app.modules.ordering.infrastructure import models as ordering_models
from app.modules.stores import models as stores_models
from app.modules.subscriptions import models as subscriptions_models
from app.shared.db import Base

__all__ = [
    "Base",
    "catalog_models",
    "iam_models",
    "inventory_models",
    "ordering_models",
    "stores_models",
    "subscriptions_models",
]
