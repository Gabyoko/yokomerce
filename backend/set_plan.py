"""
Cambia el plan de una tienda. El cobro del Pro es manual (SPEC.md, sección 10): cuando la tienda paga,
se activa con este comando.

    python -m uv run python set_plan.py dulcesdeana pro --dias 30
    python -m uv run python set_plan.py dulcesdeana free

Un Pro vencido sigue funcionando 7 días más y después la tienda cuenta como gratis. Nunca se borra nada.
"""

import argparse
import sys
from datetime import timedelta

from sqlalchemy import select

import app.models  # noqa: F401  # registra todas las tablas
from app.modules.stores.models import StoreModel
from app.modules.subscriptions.service import set_plan
from app.shared.db import unit_of_work
from app.shared.domain.time import utc_now


def main() -> None:
    parser = argparse.ArgumentParser(description="Cambia el plan de una tienda.")
    parser.add_argument("slug", help="link de la tienda, por ejemplo dulcesdeana")
    parser.add_argument("plan", choices=["free", "pro"])
    parser.add_argument("--dias", type=int, default=None, help="días hasta que vence el Pro (sin esto, no vence)")
    args = parser.parse_args()
    if args.plan == "free" and args.dias is not None:
        sys.exit("El plan gratis no vence: no uses --dias.")
    if args.dias is not None and args.dias < 1:
        sys.exit("--dias debe ser 1 o más.")

    with unit_of_work() as uow:
        store_id = uow.session.scalar(select(StoreModel.id).where(StoreModel.slug == args.slug))
        if store_id is None:
            sys.exit(f"No existe la tienda {args.slug!r}.")
        expires = None if args.dias is None else utc_now() + timedelta(days=args.dias)
        set_plan(uow.session, store_id, args.plan, expires)
        uow.commit()
    until = "sin vencimiento" if expires is None else f"hasta el {expires:%Y-%m-%d}"
    print(f"Listo: {args.slug} ahora tiene el plan {args.plan} ({until}).")


if __name__ == "__main__":
    main()
