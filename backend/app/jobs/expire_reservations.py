"""
Vence las reservas de los pedidos sin pagar, cada 15 minutos (SPEC.md, sección 7).
Corre dentro de la API en un hilo aparte. Si hay varias copias de la API no pasa nada: cada pedido se
revisa con bloqueo, así que solo una lo vence. Para correrla una vez a mano:

    python -m uv run python -m app.jobs.expire_reservations
"""

import logging
import threading

from app.modules.inventory.public import register_event_handlers
from app.modules.ordering.public import expire_due_orders
from app.shared.db import unit_of_work
from app.shared.events import bus

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 15 * 60


def run_once() -> int:
    return expire_due_orders(unit_of_work)


def _loop(stop: threading.Event) -> None:
    # Una pasada al arrancar y luego cada 15 minutos. Un error no detiene la tarea: se reintenta en la siguiente
    while True:
        try:
            expired = run_once()
            if expired:
                logger.info("Pedidos vencidos: %s", expired)
        except Exception:
            logger.exception("Falló el vencimiento de reservas")
        if stop.wait(INTERVAL_SECONDS):
            return


def start_in_background() -> threading.Event:
    """Arranca la tarea y devuelve la señal para detenerla al apagar la API."""
    stop = threading.Event()
    threading.Thread(target=_loop, args=(stop,), name="vencer-reservas", daemon=True).start()
    return stop


if __name__ == "__main__":
    register_event_handlers(bus)
    print(f"Pedidos vencidos: {run_once()}")
