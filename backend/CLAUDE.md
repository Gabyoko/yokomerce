# Backend · FastAPI

Lee también el `CLAUDE.md` de la raíz. La arquitectura del backend está en `SPEC.md`, sección 12. No empieces el backend hasta que se pida la fase B.

## Stack

- Python 3.12 o superior, con `uv` para dependencias y entorno
- FastAPI
- PostgreSQL con SQLAlchemy 2 (estilo tipado) y Alembic para migraciones
- Pydantic v2 y `pydantic-settings` para la configuración
- pytest para pruebas

## Arquitectura: monolito modular, DDD donde importa

Módulos en `app/modules/`, uno por contexto del negocio:

| Módulo | Nivel |
| --- | --- |
| `ordering`, `inventory` | DDD: `domain/`, `application/`, `infrastructure/`, `interfaces/`, `public.py` |
| `catalog` | Intermedio: capas simples + `domain/variants.py` para generar combinaciones |
| `stores`, `subscriptions`, `iam` | Simple: `router.py` → `service.py` → `models.py`, `schemas.py`, `public.py` |
| `reporting` | Solo lectura: `router.py` y `queries.py` |

Lo común va en `app/shared/` (unidad de trabajo, `CamelModel`, errores, bus de eventos, value objects).

No agregues capas de DDD a los módulos simples. Si un módulo simple empieza a tener reglas complejas, propón profundizarlo antes de hacerlo.

## Reglas entre módulos (obligatorias)

1. Un módulo usa otro solo a través de su `public.py`. Nunca importa sus modelos, repositorios ni dominio.
2. Cada módulo escribe solo en sus propias tablas. Solo `reporting` hace consultas que cruzan módulos, y solo para leer.
3. Los eventos de dominio se despachan en el mismo proceso, de forma síncrona, dentro de la misma transacción y antes del commit.
4. Todos los routers `/me/*` usan `get_current_store()` de `iam`, y toda consulta filtra por esa tienda.

## Reglas dentro de un módulo DDD

- `domain/` es Python puro: no importa FastAPI, SQLAlchemy ni otros módulos. Ahí viven los agregados (`Order`, `StockItem`), los value objects y los eventos.
- Las reglas de negocio están en los métodos de los agregados (por ejemplo, `Order.confirm_payment()` valida la transición). Los casos de uso de `application/` solo orquestan.
- Los routers de `interfaces/` validan, llaman a un caso de uso y devuelven un esquema. Nunca tienen SQL ni reglas.

## Contrato

- Los esquemas de `interfaces/schemas.py` (o `schemas.py`) coinciden campo por campo con `frontend/shared/types/`.
- Todos heredan de `CamelModel`: se escribe `price_cents` en Python y el JSON sale `priceCents`.
- Errores: subclases de `DomainError` (`InvalidTransition`, `OutOfStock`, `NotFound`, `LimitReached`) que un manejador global convierte en `{ "error": "codigo", "message": "texto" }`.
- Dinero en céntimos (`int`) con el value object `Money`. Fechas con zona horaria.

## Stock (obligatorio)

- El stock vive en `stock_items` (módulo inventory), no en `variants`.
- Reservas con `UPDATE` atómico (`WHERE on_hand - reserved >= cantidad`) verificando cuántas filas cambió. Nunca leer y luego escribir en dos pasos.
- Los demás cambios usan el agregado `StockItem` con bloqueo optimista (columna `version`).
- Si un ítem del pedido no alcanza, se deshace todo el pedido.
- Cada cambio de stock registra un `stock_movements` en la misma transacción.

## Pruebas obligatorias

- `tests/unit/`: reglas de `Order` y `StockItem` sin base de datos.
- `tests/concurrency/`: varios pedidos simultáneos por la última unidad, solo uno pasa.
- Aislamiento: un dueño no puede ver ni modificar datos de otra tienda.
- Contrato: las respuestas salen en `camelCase` con los campos de `frontend/shared/types/`.

## Comandos (dentro de `backend/`)

- `uv run fastapi dev app/main.py` para desarrollo (Swagger en `http://localhost:8000/docs`)
- `docker compose up -d` para levantar PostgreSQL en desarrollo
- `uv run alembic upgrade head` para aplicar migraciones
- `uv run python seed.py` para borrar todo y cargar las tres tiendas de prueba (lee `seed_data.json`, exportado de `frontend/mocks/data`)
- `uv run python dev_token.py dulcesdeana` crea un token para probar `/me/*` en `/docs` (botón Authorize), sin cuenta de Supabase; solo desarrollo
- `uv run python set_plan.py dulcesdeana pro --dias 30` activa el plan Pro de una tienda (el cobro es manual)
- `uv run pytest` antes de dar una tarea por terminada (las de integración usan la base `yokomerce_test`)
- Si `uv` no está en el PATH, usa `python -m uv` en su lugar
