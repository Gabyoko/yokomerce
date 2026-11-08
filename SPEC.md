# Yokomerce · Especificación

Versión 3 · octubre 2026 · enfoque: frontend primero con datos de prueba · backend en FastAPI

## 1. Qué es

Un negocio crea su tienda, sube sus productos y obtiene un link (`yokomerce.pe/nombre-del-negocio`). Lo comparte en WhatsApp, Instagram o TikTok. El cliente abre el link sin registrarse, arma su pedido y al confirmar se abre WhatsApp con el pedido ya escrito para enviárselo al negocio. El negocio gestiona pedidos, productos y stock desde un panel.

**Usuarios:**
- **Dueño del negocio:** inicia sesión, configura su tienda, gestiona productos, pedidos y stock.
- **Cliente:** no tiene cuenta. Ve el catálogo, pide y paga directo al negocio (Yape, Plin, efectivo o transferencia).
- **Administrador (tú):** activa planes a mano al inicio.

**Fuera de alcance en la versión 1:** pagos dentro de la app, API oficial de WhatsApp, apps nativas, facturación electrónica, funciones con IA.

## 2. Enfoque de desarrollo

El proyecto se construye en tres fases:

1. **Fase F · Frontend con API de prueba.** Todas las pantallas y flujos funcionan contra una API falsa que vive dentro de Next.js. Permite mostrar la app a negocios reales y validar el diseño.
2. **Fase B · Backend real.** Se implementa el mismo contrato (secciones 4 y 5) con la tecnología elegida.
3. **Fase C · Conexión.** Se apunta el frontend al backend real y se elimina la API de prueba.

```
Fase F:  Páginas → features/*/api.ts → apiFetch → /api/mock/*  (route handlers + datos en memoria)
Fase C:  Páginas → features/*/api.ts → apiFetch → backend real
```

Las páginas y las funciones `api.ts` de cada feature no cambian entre fases. Solo cambia `NEXT_PUBLIC_API_URL` y la parte de autenticación dentro de `apiFetch` (sección 5).

**Reglas de la fase F:**
- Los tipos de `shared/types/` son el contrato. El backend los implementará igual.
- Nada fuera de `mocks/` y `app/api/mock/` importa de `mocks/`.
- La lógica de negocio simulada (stock, totales, estados) vive solo en `mocks/` y `app/api/mock/`. Debe seguir las reglas de la sección 7 para que el comportamiento sea el mismo que tendrá el backend real.
- La base de datos falsa se guarda en memoria del servidor en `globalThis`, para que sobreviva a las recargas en desarrollo. Al reiniciar el servidor vuelve a los datos iniciales.
- Cada respuesta de la API de prueba tiene un retraso de 300 ms para ver los estados de carga.
- `NEXT_PUBLIC_API_URL=http://localhost:3000/api/mock` (URL completa, porque los componentes de servidor también llaman a la API).

**Backend (decidido):** API REST propia en Python con FastAPI, PostgreSQL, SQLAlchemy, Alembic y Pydantic. Monolito modular por contextos del negocio, con DDD en los módulos de pedidos e inventario. Documentación automática con Swagger (OpenAPI) en `/docs`. Debe implementar exactamente el contrato de las secciones 4 y 5. La sección 12 describe su arquitectura.

### Arquitectura general

Un solo repositorio (monorepo) con dos aplicaciones independientes que se comunican solo por HTTP:

```
yokomerce/
├── CLAUDE.md          # reglas generales
├── SPEC.md
├── design/            # diseño de referencia
├── frontend/          # Next.js (puerto 3000)  + su CLAUDE.md
└── backend/           # FastAPI (puerto 8000)  + su CLAUDE.md
```

```
Navegador ──► Next.js (frontend) ──apiFetch──► FastAPI (backend) ──► PostgreSQL
                                                     ├──► almacenamiento de imágenes
                                                     └──► tarea programada (vencer reservas)
```

- El frontend no accede nunca a la base de datos. Todo pasa por la API.
- El backend no genera HTML. Solo responde JSON.
- En producción se despliegan por separado (por ejemplo, el front en Vercel y el back en Railway o Render).

### Arquitectura del frontend: por features

El front no usa DDD: las reglas de negocio viven en el backend. Se organiza por **features** (funcionalidades), y cada feature agrupa todo lo suyo: componentes, hooks, llamadas a la API y validaciones.

```
frontend/
├── app/                             # solo rutas; cada página es delgada y arma features
│   ├── page.tsx                     # landing
│   ├── ingresar/ · registro/
│   ├── [slug]/                      # tienda pública
│   │   ├── page.tsx                 # catálogo
│   │   ├── p/[productId]/page.tsx
│   │   ├── carrito/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── pedido/[token]/page.tsx
│   ├── panel/                       # panel del negocio (layout con menú)
│   │   ├── page.tsx                 # pedidos y métricas
│   │   ├── pedidos/[id]/
│   │   ├── productos/ (nuevo, [id])
│   │   ├── configuracion/
│   │   └── plan/
│   ├── api/mock/                    # API de prueba (solo fase F)
│   └── dev/componentes/             # catálogo de componentes (solo desarrollo)
├── features/
│   ├── catalog/                     # catálogo público, detalle, selector de opciones
│   ├── cart/                        # carrito en localStorage
│   ├── checkout/                    # datos de entrega, crear pedido, mensaje de WhatsApp
│   ├── orders/                      # panel de pedidos, detalle, estados
│   ├── products/                    # crear y editar productos, opciones, combinaciones
│   ├── inventory/                   # stock, ajustes, historial, alertas
│   ├── store-settings/              # registro y configuración de la tienda
│   ├── dashboard/                   # métricas y lo más vendido
│   ├── plans/                       # límites, candados, página de plan
│   └── auth/                        # sesión del dueño
│       ├── components/
│       ├── hooks/
│       ├── api.ts                   # funciones de esta feature (usan apiFetch)
│       ├── schemas.ts               # validación Zod de sus formularios
│       ├── lib/                     # utilidades propias de la feature
│       └── index.ts                 # API pública: lo único que otros pueden importar
├── shared/
│   ├── ui/                          # Button, Input, Select, Badge, Switch, Modal, Toast...
│   ├── api/client.ts                # apiFetch y ApiError
│   ├── lib/                         # formatSoles, fechas, teléfonos, compresión de imágenes
│   └── types/                       # el contrato (sección 4)
├── mocks/                           # datos y lógica simulada (solo fase F)
│   ├── data/                        # las tres tiendas de prueba
│   ├── db.ts                        # base de datos en memoria (globalThis)
│   └── logic/                       # pedidos, stock, estados (reglas de la sección 7)
└── tests/e2e/                       # Playwright
```

**Reglas de dependencia:**
1. `app/` solo arma features y casi no tiene lógica.
2. Una feature importa otra solo a través de su `index.ts`, nunca sus archivos internos.
3. `shared/` no importa nada de `features/` ni de `app/`.
4. Nada fuera de `mocks/` y `app/api/mock/` importa de `mocks/`.
5. Solo `shared/api/client.ts` hace `fetch` a la API.

**Principios:**
- **Servidor por defecto:** catálogo, detalle y listas se renderizan en el servidor (rápido con datos móviles y buen link al compartir). Componentes de cliente solo donde hay interacción.
- **Sin estado global pesado:** el carrito vive en `localStorage` con un hook de `features/cart`; el resto de datos se pide a la API y se refresca tras cada acción.
- **Formularios:** validación con Zod para avisar rápido, pero la decisión final la toma la API.
- **Mismos nombres que el backend:** `orders` ↔ ordering, `inventory` ↔ inventory, `catalog` y `products` ↔ catalog, `store-settings` ↔ stores, `plans` ↔ subscriptions, `dashboard` ↔ reporting.

La arquitectura del backend está en la sección 12.

## 3. Principio: una app configurable

La app sirve para cualquier rubro. No existe lógica de "comida" o "ropa". La diferencia entre negocios viene de tres piezas:

1. **Opciones de producto** que crea el dueño (cualquier nombre: Talla, Color, Aroma, Modelo de celular...). Máximo 3 por producto.
2. **Campos extra** que crea el dueño (Dedicatoria, Grabado, Nombre para estampar...). Solo texto.
3. **Funciones de la tienda** que se activan o desactivan:

| Función | Campo en `StoreFeatures` | Efecto si está activa |
| --- | --- | --- |
| Fecha de entrega | `deliveryDate` | El cliente elige el día en el checkout |
| Días de anticipación | `leadTimeDays` (0 = sin anticipación) | La primera fecha elegible es hoy + N días |
| Pedidos por encargo | `madeToOrder` | Permite marcar productos como "por encargo" (sin stock) |
| Guía de tallas | `sizeGuide` | Permite adjuntar una guía a los productos |
| Delivery por zonas | `deliveryZones` | El cliente elige su distrito y se suma su precio |
| Recojo en tienda | `pickup` | Opción gratuita de recojo |
| Envío a provincia | `shipping` | El cliente indica ciudad; precio fijo o "a coordinar" |

Al menos un tipo de entrega (zonas, recojo o envío) debe estar activo.

**Registro:** en lugar de elegir un rubro, el dueño responde 4 preguntas y se activan funciones:
1. ¿Tus clientes eligen el día de entrega? → `deliveryDate`
2. ¿Preparas productos por encargo? → `madeToOrder` y sugiere `leadTimeDays = 1`
3. ¿Tus productos tienen variantes como talla, color o tamaño? → muestra la ayuda de opciones al crear productos
4. ¿Haces envíos fuera de tu ciudad? → `shipping`

Todo se puede cambiar después en Configuración.

## 4. Contrato de datos (`shared/types/`)

Todo el stock vive en las variantes. **Un producto sin opciones tiene exactamente una variante por defecto** (con `label` vacío y sin valores de opción).

```ts
// shared/types/common.ts
export type Cents = number;           // entero, S/ 45.00 = 4500
export type ISODate = string;         // "2026-10-31"
export type ISODateTime = string;     // "2026-10-29T15:28:00Z"
export type PaymentMethod = "yape" | "plin" | "cash" | "transfer";
export type FulfillmentType = "delivery" | "pickup" | "shipping";
export type OrderStatus = "new" | "paid" | "preparing" | "delivered" | "cancelled" | "expired";
export type PlanId = "free" | "pro";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

// shared/types/store.ts
export interface StoreFeatures {
  deliveryDate: boolean;
  leadTimeDays: number;
  madeToOrder: boolean;
  sizeGuide: boolean;
  deliveryZones: boolean;
  pickup: boolean;
  shipping: boolean;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  city: string;
  whatsapp: string;                    // "51912345678"
  businessHours: Record<Weekday, { open: string; close: string } | null>; // "09:00"
  paymentMethods: PaymentMethod[];
  paymentInstructions: string | null;  // ej. "Yape al 912 345 678 a nombre de Ana Torres"
  features: StoreFeatures;
  pickupAddress: string | null;
  shippingFeeCents: Cents | null;      // null = "a coordinar"
  reservationHours: number;            // 24 por defecto
  plan: PlanId;
  planExpiresAt: ISODateTime | null;
}

export interface DeliveryZone {
  id: string;
  name: string;                        // "Santiago de Surco"
  priceCents: Cents;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  position: number;
}

// shared/types/product.ts
export interface OptionValue { id: string; value: string }               // "M"
export interface ProductOption { id: string; name: string; values: OptionValue[] } // "Talla"

export interface CustomField {
  id: string;
  label: string;                       // "Dedicatoria"
  required: boolean;
  maxLength: number;                   // 60 por defecto
}

/** Variante tal como la ve el cliente */
export interface Variant {
  id: string;
  optionValueIds: string[];            // vacío en la variante por defecto
  label: string;                       // "Negro / M"
  priceCents: Cents;
  available: number;                   // onHand - reserved
  lowStock: boolean;                   // available <= lowStockThreshold
  active: boolean;
}

/** Variante tal como la ve el dueño en el panel */
export interface VariantAdmin extends Variant {
  onHand: number;                      // "En total"
  reserved: number;
  lowStockThreshold: number | null;
}

export interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  images: string[];                    // máximo 5
  madeToOrder: boolean;                // sin control de stock
  sizeGuideUrl: string | null;
  visible: boolean;
  position: number;
  options: ProductOption[];
  variants: Variant[];
  customFields: CustomField[];
  priceFromCents: Cents;               // precio más bajo entre variantes activas
}

export interface ProductAdmin extends Omit<Product, "variants"> {
  variants: VariantAdmin[];
}

export interface Catalog {
  store: Store;
  categories: Category[];
  products: Product[];                 // solo visibles
  deliveryZones: DeliveryZone[];       // solo activas
}

// shared/types/order.ts
export interface OrderItem {
  variantId: string;
  productName: string;                 // copia al momento del pedido
  variantLabel: string;
  unitPriceCents: Cents;
  quantity: number;
  lineTotalCents: Cents;
  customValues: Record<string, string>; // { "Dedicatoria": "Feliz cumpleaños, Lucía" }
  tracksStock: boolean;
}

export interface Order {
  id: string;
  number: number;                      // 42 → se muestra "#0042"
  publicToken: string;
  status: OrderStatus;
  customer: { name: string; phone: string };
  fulfillment: {
    type: FulfillmentType;
    zoneName: string | null;
    city: string | null;
    address: string | null;
    reference: string | null;
  };
  deliveryDate: ISODate | null;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotalCents: Cents;
  deliveryFeeCents: Cents | null;      // null = envío a coordinar
  totalCents: Cents;
  reservedUntil: ISODateTime;
  createdAt: ISODateTime;
  paidAt: ISODateTime | null;
  deliveredAt: ISODateTime | null;
  cancelledAt: ISODateTime | null;
  notes: string | null;                // nota interna del negocio
}

/** Lo que ve el cliente en /[slug]/pedido/[token] */
export type PublicOrder = Omit<Order, "id" | "notes">;

export interface CreateOrderInput {
  storeSlug: string;
  items: { variantId: string; quantity: number; customValues: Record<string, string> }[];
  customer: { name: string; phone: string };
  fulfillment: {
    type: FulfillmentType;
    zoneId?: string;
    city?: string;
    address?: string;
    reference?: string;
  };
  deliveryDate?: ISODate;
  paymentMethod: PaymentMethod;
}

export type CreateOrderResult =
  | { ok: true; order: PublicOrder }
  | { ok: false; error: "out_of_stock"; items: { variantId: string; available: number }[] }
  | { ok: false; error: "validation"; fields: Record<string, string> }
  | { ok: false; error: "rate_limited" };

// shared/types/stock.ts
export type StockMovementType = "reserve" | "release" | "sale" | "in" | "out" | "adjust";

export interface StockMovement {
  id: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;                    // positivo o negativo según el efecto
  reason: string | null;               // "venta_tienda", "feria", "merma", "regalo", "produccion", "correccion", "cancelacion"
  orderNumber: number | null;
  createdBy: string | null;            // null = automático
  createdAt: ISODateTime;
}

export interface StockAdjustmentInput {
  type: "in" | "out" | "adjust";       // adjust = fijar el total exacto
  quantity: number;
  reason: string;
}

// shared/types/dashboard.ts
export interface DashboardStats {
  ordersToday: number;
  pendingConfirmation: number;
  salesWeekCents: Cents;
  ordersWeek: number;
  averageTicketCents: Cents;
  lowStockCount: number;
  topProducts: { name: string; units: number }[];
}
// --- Entradas del panel (agregadas en la fase F2) ---

// shared/types/store.ts
/** POST /me/store — registro. Las respuestas activan funciones (sección 3). */
export interface CreateStoreInput {
  ownerName: string;
  name: string;
  slug: string;
  whatsapp: string;                    // celular de 9 dígitos; la API lo guarda con el prefijo 51
  city: string;
  answers: {
    deliveryDate: boolean;             // ¿Tus clientes eligen el día de entrega?
    madeToOrder: boolean;              // ¿Preparas productos por encargo? (sugiere leadTimeDays = 1)
    shipping: boolean;                 // ¿Haces envíos fuera de tu ciudad?
  };
}

/** PATCH /me/store — solo los campos que cambian. El slug no se puede cambiar. */
export type UpdateStoreInput = Partial<Pick<Store,
  "name" | "description" | "logoUrl" | "coverUrl" | "city" | "whatsapp" | "businessHours" |
  "paymentMethods" | "paymentInstructions" | "pickupAddress" | "shippingFeeCents" | "reservationHours"
>> & { features?: Partial<StoreFeatures> };

/** PUT /me/zones — la lista completa; sin id = nueva; las que no vienen se borran. */
export interface ZoneInput { id?: string; name: string; priceCents: Cents; active: boolean }

/** PUT /me/categories — la lista completa en orden; sin id = nueva; las que no vienen se borran. */
export interface CategoryInput { id?: string; name: string }

// shared/types/product.ts
/**
 * POST /me/products y PUT /me/products/:id.
 * Las variantes se identifican por sus valores de opción (texto), porque los valores nuevos
 * todavía no tienen id. Debe venir exactamente una variante por combinación.
 */
export interface ProductInput {
  categoryId: string | null;
  name: string;
  description: string;
  images: string[];                    // máximo 5
  madeToOrder: boolean;
  sizeGuideUrl: string | null;
  visible: boolean;
  options: { id?: string; name: string; values: { id?: string; value: string }[] }[]; // máximo 3
  variants: {
    id?: string;
    optionValues: string[];            // ["Negro", "M"] en el orden de options; vacío en la variante por defecto
    priceCents: Cents;
    active: boolean;
    lowStockThreshold: number | null;
    initialStock?: number;             // solo en variantes nuevas; después el stock cambia con ajustes
  }[];
  customFields: { id?: string; label: string; required: boolean; maxLength: number }[];
}

// shared/types/stock.ts
/** POST /me/variants/:id/adjustments — el movimiento creado y la variante con su stock nuevo. */
export interface StockAdjustmentResult {
  movement: StockMovement;
  variant: VariantAdmin;
}
```

## 5. Contrato de API

Cada función de los archivos `features/*/api.ts` corresponde a un endpoint. La columna "Feature" indica dónde vive. En la fase F los endpoints viven en `app/api/mock/`; en la fase C, en el backend FastAPI, con las mismas rutas. Las respuestas siguen los tipos de la sección 4.

**Formato común (API de prueba y backend real):**
- JSON con nombres en `camelCase` (`priceCents`, no `price_cents`).
- Dinero en céntimos enteros. Fechas como texto ISO.
- Errores: `{ "error": "codigo", "message": "texto para mostrar" }` con el código HTTP adecuado (400 validación, 401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto de stock o estado, 429 demasiadas peticiones).

### Cliente HTTP único: `apiFetch`

Todas las funciones de `features/*/api.ts` usan `apiFetch` de `shared/api/client.ts`. Ningún otro archivo hace `fetch` a la API.

```ts
// shared/api/client.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body: Record<string, unknown> = {}) { super(message); }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeaders()), ...init.headers },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "unknown", body.message ?? "Algo salió mal");
  }
  return res.json() as Promise<T>;
}

// Fase F: lee la cookie mock_store y envía { "X-Mock-Store": "<slug>" }.
//         En el servidor con cookies() de next/headers; en el cliente con document.cookie.
// Fase C: envía { "Authorization": "Bearer <token>" } de la sesión real.
async function authHeaders(): Promise<Record<string, string>> {
  // implementación de la fase actual
}
```

`apiFetch` funciona tanto en componentes de servidor como de cliente. Al conectar el backend real, solo cambian `NEXT_PUBLIC_API_URL` y `authHeaders()`.

**Respuestas de `POST /public/orders`:** éxito `201 { ok: true, order }`. Los errores esperados usan su código HTTP y llevan el resto de `CreateOrderResult` junto a `message`: `400 { ok: false, error: "validation", message, fields }`, `409 { ok: false, error: "out_of_stock", message, items }` y `429 { ok: false, error: "rate_limited", message }`. `ApiError.body` guarda el cuerpo completo para que `createOrder` devuelva el `CreateOrderResult` sin lanzar error. Las claves de `fields` siguen la forma del input: `customer.phone`, `fulfillment.zoneId`, `deliveryDate`, `items.0.quantity`, `items.0.customValues.<etiqueta>`.

**Públicos (sin sesión)**
| Función | Endpoint | Feature (front) | Módulo (back) |
| --- | --- | --- | --- |
| `getCatalog(slug)` | `GET /public/stores/:slug` → `Catalog` | catalog | catalog |
| `getProduct(slug, productId)` | `GET /public/stores/:slug/products/:id` → `Product` | catalog | catalog |
| `createOrder(input)` | `POST /public/orders` → `CreateOrderResult` | checkout | ordering |
| `getPublicOrder(slug, token)` | `GET /public/stores/:slug/orders/:token` → `PublicOrder` | checkout | ordering |
| `checkSlug(slug)` | `GET /public/slugs/:slug` → `{ available: boolean }` | store-settings | stores |

**Panel (con sesión)**
| Función | Endpoint | Feature (front) | Módulo (back) |
| --- | --- | --- | --- |
| `getMyStore()` | `GET /me/store` → `Store` | store-settings | stores |
| `createStore(input)` | `POST /me/store` (`CreateStoreInput`) → `Store` | store-settings | stores |
| `updateStore(patch)` | `PATCH /me/store` (`UpdateStoreInput`) → `Store` | store-settings | stores |
| `listZones()` / `saveZones(zones)` | `GET` / `PUT /me/zones` (`ZoneInput[]`) → `DeliveryZone[]` | store-settings | stores |
| `listCategories()` / `saveCategories(c)` | `GET` / `PUT /me/categories` (`CategoryInput[]`) → `Category[]` | products | catalog |
| `getDashboardStats()` | `GET /me/stats` → `DashboardStats` | dashboard | reporting |
| `listOrders({ status?, search? })` | `GET /me/orders?status=&search=` → `Order[]` | orders | ordering |
| `getOrder(id)` | `GET /me/orders/:id` → `Order` | orders | ordering |
| `confirmPayment(id)` | `POST /me/orders/:id/confirm-payment` → `Order` | orders | ordering |
| `startPreparing(id)` | `POST /me/orders/:id/start-preparing` → `Order` | orders | ordering |
| `markDelivered(id)` | `POST /me/orders/:id/deliver` → `Order` | orders | ordering |
| `cancelOrder(id)` | `POST /me/orders/:id/cancel` → `Order` | orders | ordering |
| `updateOrderNotes(id, notes)` | `PATCH /me/orders/:id` (`{ notes }`) → `Order` | orders | ordering |
| `listProducts()` | `GET /me/products` → `ProductAdmin[]` | products | catalog |
| `getProductAdmin(id)` | `GET /me/products/:id` → `ProductAdmin` | products | catalog |
| `createProduct(input)` / `updateProduct(id, input)` | `POST /me/products` / `PUT /me/products/:id` (`ProductInput`) → `ProductAdmin` | products | catalog |
| `setProductVisible(id, visible)` | `PATCH /me/products/:id` (`{ visible }`) → `ProductAdmin` | products | catalog |
| `uploadImage(file)` | `POST /me/uploads` (multipart, campo `file`) → `{ url }` | products | catalog |
| `adjustStock(variantId, input)` | `POST /me/variants/:id/adjustments` (`StockAdjustmentInput`) → `StockAdjustmentResult` | inventory | inventory |
| `listStockMovements(variantId)` | `GET /me/variants/:id/movements` → `StockMovement[]` (más recientes primero; Pro) | inventory | inventory |

**Reglas del panel:** las listas de zonas y categorías se guardan completas (las que no vienen se borran; los productos de una categoría borrada quedan sin categoría). Al editar un producto se conservan los ids de opciones, valores y variantes que ya existen; el stock de una variante existente solo cambia con ajustes, y no se puede quitar una variante con unidades reservadas (`409 variant_reserved`). Crear productos por encima del límite del plan responde `403 plan_limit`; el historial de stock en el plan gratis, `403 plan_required` (solo si `NEXT_PUBLIC_PLANS_ENFORCED=true`). `apiFetch` no envía `Content-Type: application/json` cuando el cuerpo es `FormData`.

**Sesión en la fase F:** no hay login real. Una cookie `mock_store` guarda qué tienda es "la mía" (por defecto `dulcesdeana`), `apiFetch` la envía en la cabecera `X-Mock-Store` y la API de prueba la usa en los endpoints `/me/*`. En desarrollo, el panel muestra un selector para cambiar entre las tres tiendas de prueba y comprobar que las funciones configurables se comportan bien. Las pantallas de `/ingresar` y `/registro` existen pero solo simulan el flujo.

**Sesión en el backend real (fase B):** el login (link mágico al correo y Google) lo hace **Supabase Auth** desde el front. Los endpoints `/me/*` reciben `Authorization: Bearer <token>` y el back verifica la firma con las claves públicas de Supabase. Respuestas: `401 unauthorized` (sin token o token inválido), `404 no_store` (sesión válida, todavía sin tienda: el front lleva a `/registro`), `409 email_in_use` (ese correo ya es de otra cuenta) y `503 auth_unavailable` (no se pudo revisar la sesión: reintentar sin cerrarla). `POST /me/store` responde `409 store_exists` si el usuario ya tiene tienda (una por dueño).

**Otros conflictos del backend real:** un ajuste de stock que choca con otro cambio simultáneo responde `409 stock_changed`: el panel vuelve a pedir los datos y reintenta. Las reservas vencen con una tarea cada 15 minutos; si el dueño intenta confirmar un pedido cuya reserva ya pasó, ese pedido se vence en ese momento y responde `409 invalid_status`.

**Imágenes en la fase F:** `uploadImage` devuelve una URL de imagen de prueba. Antes de subir, el front comprime la foto (máx. 1200 px, WebP); eso se mantiene en la fase C.

**Imágenes en el backend real:** `POST /me/uploads` acepta solo JPG, PNG o WebP de hasta 5 MB (el tipo se reconoce por el contenido del archivo, no por su nombre) y responde `201 { url }`. Si no, `400 validation` con `fields.file`. Las fotos se guardan en `stores/<id de la tienda>/<nombre al azar>`: en desarrollo, en una carpeta que la API sirve en `/uploads`; en producción, en un bucket público de Supabase Storage (`503 storage_unavailable` si falla).

**Planes en el backend real:** el plan gratis recibe `403 plan_limit` al pasar de 20 productos y `403 plan_required` en el historial de stock; en `/me/stats` recibe en 0 las ventas de la semana, el ticket promedio y la lista de lo más vendido (con candado en el front). Durante la beta (`PLANS_ENFORCED=false`) todos son Pro. El Pro se activa a mano con `backend/set_plan.py`.

**Pruebas en la fase F:** `POST /api/mock/dev/reset` vuelve la API de prueba a los datos iniciales. Solo existe en desarrollo, lo usan las pruebas de Playwright y no es parte del contrato.

## 6. Datos de prueba (`mocks/`)

Tres tiendas que cubren las combinaciones de funciones. Cada una con 6 a 10 productos, 8 a 15 pedidos en distintos estados (de los últimos 7 días) y movimientos de stock coherentes.

1. **Dulces de Ana** (`dulcesdeana`), pastelería en Lima. Funciones: fecha de entrega, 1 día de anticipación, encargos, zonas de delivery (Santiago de Surco S/ 8, Miraflores S/ 10, Barranco S/ 10) y recojo. Pagos: Yape, Plin, efectivo. Productos:
   - Torta de chocolate · opción Tamaño (Mediana S/ 45, Grande S/ 70) · campo extra Dedicatoria · Grande con 1 disponible
   - Cheesecake de maracuyá S/ 55 · 2 disponibles (stock bajo)
   - Alfajores x12 S/ 18
   - Keke de naranja S/ 25 · agotado
   - Torta tres leches S/ 50 · por encargo
2. **Taller Norte** (`tallernorte`), ropa urbana. Funciones: guía de tallas, envío a provincia (S/ 15), zonas de delivery. Sin fecha de entrega. Pagos: Yape, Plin, transferencia. Productos:
   - Polo oversize S/ 45 · opciones Talla (S, M, L, XL) y Color (Negro, Blanco, Verde oliva) · 12 combinaciones, 3 agotadas
   - Casaca denim S/ 129 · Talla
   - Jogger S/ 69 · Talla y Color
3. **Funda Lab** (`fundalab`), accesorios de celular. Funciones: envío a provincia (a coordinar), recojo en tienda. Sin zonas de delivery ni fecha. Pagos: Yape, transferencia. Productos:
   - Funda transparente S/ 25 · opción Modelo de celular
   - Funda personalizada S/ 39 · opciones Modelo de celular y Color · campo extra Nombre para personalizar (obligatorio, máx. 20)
   - Cargador rápido S/ 49 · sin opciones

Incluye al menos una variante con exactamente 1 disponible para probar el error `out_of_stock`.

## 7. Reglas de negocio

Estas reglas las implementa la API (primero la de prueba, luego la real). El front solo muestra lo que la API responde.

### Stock
- Disponible = `onHand - reserved`. Ninguno puede ser negativo y `reserved <= onHand`.
- **Crear pedido:** recalcula precios desde los datos guardados (nunca usa precios enviados por el navegador), valida todo y reserva el stock de cada ítem que lo controla. Si algún ítem no alcanza, no se crea nada y responde `out_of_stock` con los disponibles actuales.
- **Confirmar pago:** `onHand -= q`, `reserved -= q`, movimiento `sale`.
- **Cancelar:** si estaba `new`, libera la reserva (movimiento `release`). Si estaba `paid` o `preparing`, devuelve el stock (`onHand += q`, movimiento `in`, motivo `cancelacion`).
- **Vencer:** un pedido `new` cuyo `reservedUntil` ya pasó pasa a `expired` y libera su reserva. En la fase F se revisa en cada petición a la API de prueba; en el backend real, con una tarea programada cada 15 minutos.
- **Ajuste manual:** `in` suma, `out` resta, `adjust` fija el total. Nunca puede dejar `onHand < reserved`.
- Productos `madeToOrder`: no reservan ni descuentan stock. En la API se informan con `available = 99` (el máximo por línea) y `lowStock = false`, para que nunca aparezcan agotados. Si la función `madeToOrder` de la tienda está apagada, el producto se trata como uno normal.
- `available = 0` → "Agotado" (tachado en el selector). `lowStock` → badge "Quedan N" en la tienda y alerta en el panel.
- Todo cambio de stock crea un `StockMovement`. El historial debe permitir reconstruir el stock.
- Signo de `StockMovement.quantity`: negativo si baja lo disponible o el total (`reserve`, `sale`, `out`), positivo si lo sube (`release`, `in`); en `adjust`, la diferencia entre el total nuevo y el anterior.

### Estados del pedido
`new` → `paid` → `preparing` → `delivered`. Además `cancelled` (desde `new`, `paid` o `preparing`) y `expired` (automático desde `new`). Cualquier otra transición se rechaza.

En la interfaz: Nuevo, Pagado, Preparando, Entregado, Cancelado, Vencido.

### Totales y entrega
- `subtotal` = suma de líneas. `deliveryFee`: precio de la zona, 0 en recojo, `shippingFeeCents` en envío (o `null` si es "a coordinar").
- Solo se aceptan tipos de entrega y fechas de funciones activas.
- Fecha de entrega: no en el pasado, mínimo hoy + `leadTimeDays`, en un día con horario de atención.
- Campos extra obligatorios deben venir llenos y respetar `maxLength`.
- Cantidades de 1 a 99. Celular válido peruano. Nombre de 2 a 60 caracteres.
- Límite de 5 pedidos por hora por teléfono (en la fase F se puede simular de forma simple).

### Mensaje de WhatsApp
Lo arma el front en `features/checkout/lib/whatsapp.ts` con el `PublicOrder` que devuelve la API (es solo formato, con pruebas). Luego abre `https://wa.me/<whatsapp>?text=<mensaje>` usando `encodeURIComponent`. El pedido ya está guardado aunque el cliente no envíe el mensaje. Las líneas sin dato se omiten:

```
Nuevo pedido #0042 · Dulces de Ana

2 × Torta de chocolate (Mediana) — S/ 90.00
   Dedicatoria: Feliz cumpleaños, Lucía
1 × Alfajores x12 — S/ 18.00

Subtotal: S/ 108.00
Delivery (Santiago de Surco): S/ 8.00
Total: S/ 116.00

Cliente: María López · 987 654 321
Entrega: Av. Primavera 123, dpto. 402 (Frente al parque)
Fecha: sábado 31 de octubre
Pago: Yape

Ver pedido: https://yokomerce.pe/dulcesdeana/pedido/<publicToken>
```

## 8. Rutas del frontend

**Públicas**
| Ruta | Pantalla |
| --- | --- |
| `/` | Landing |
| `/registro`, `/ingresar` | Registro e inicio de sesión del dueño |
| `/[slug]` | Catálogo de la tienda |
| `/[slug]/p/[productId]` | Detalle de producto |
| `/[slug]/carrito` | Carrito |
| `/[slug]/checkout` | Datos de entrega y pago |
| `/[slug]/pedido/[token]` | Pedido listo y vista previa del mensaje |

**Panel del negocio**
| Ruta | Pantalla |
| --- | --- |
| `/panel` | Pedidos y métricas |
| `/panel/pedidos/[id]` | Detalle de pedido |
| `/panel/productos` | Productos e inventario |
| `/panel/productos/nuevo`, `/panel/productos/[id]` | Crear y editar producto |
| `/panel/configuracion` | Datos de la tienda y funciones |
| `/panel/plan` | Plan actual y mejora a Pro |

Slugs reservados: `panel`, `registro`, `ingresar`, `api`, `admin`, `planes`, `ayuda`, `terminos`, `privacidad`, `dev`.

- El catálogo se renderiza en el servidor con metadatos Open Graph (nombre, descripción, portada) para que el link se vea bien al compartirlo.
- El carrito vive en el navegador (`localStorage`, una clave por tienda, siempre dentro de try/catch). Guarda solo `variantId`, `quantity` y `customValues`; precios y disponibilidad se vuelven a pedir a la API.
- Al llegar al checkout, si la API responde `out_of_stock`, se muestra qué productos cambiaron y se ajusta el carrito.

## 9. Pantallas y responsive

Cada pantalla se diseña para celular (390 px) y computadora (1440 px). El diseño de referencia está en `design/`.

> El diseño actual usa una pastelería y muestra "Tamaño" y "Dedicatoria" como si fueran fijos. Esta especificación manda: en el código son opciones y campos extra creados por el dueño.

**Cliente:** catálogo, detalle de producto, carrito, checkout, pedido listo.
**Negocio:** registro, configuración, crear/editar producto, panel de pedidos, detalle de pedido, productos e inventario, ajuste de stock, plan.
**Marketing:** landing.

Comportamiento responsive:
- Catálogo: 2 columnas en celular, 3 a 4 en computadora. Barra de carrito fija abajo en celular; panel lateral en computadora.
- Producto: una columna en celular; fotos a la izquierda y opciones a la derecha en computadora.
- Checkout: una columna en celular; formulario a la izquierda y resumen fijo a la derecha en computadora.
- Panel: menú inferior en celular, menú lateral en computadora. Pedidos en tarjetas (celular) o tabla (computadora).
- Ajuste de stock: pantalla completa en celular, ventana modal en computadora.

Estados obligatorios en cada pantalla con datos: cargando, vacío y error.

## 10. Planes

Durante la beta todo es gratis, pero la lógica de planes existe desde el inicio.

```ts
// features/plans/lib/plans.ts
export const PLANS = {
  free: { maxProducts: 20, maxMembers: 1, statsRange: "today", showBranding: true, stockHistory: false },
  pro:  { maxProducts: null, maxMembers: 5, statsRange: "all", showBranding: false, stockHistory: true },
} as const;
```

- `canUse(store, feature)` y `getLimit(store, key)` se usan en la interfaz para mostrar candados. El backend aplicará los mismos límites.
- Variable `NEXT_PUBLIC_PLANS_ENFORCED=false` durante la beta: todos se comportan como Pro.
- Las funciones de Pro bloqueadas se muestran con candado y enlace a `/panel/plan`; no se ocultan.
- Pedidos ilimitados en todos los planes.
- Plan vencido: nunca se borra nada. Si supera un límite, no puede crear más hasta bajar o renovar. 7 días de gracia.
- Precio del Pro: [PRECIO]. El cobro inicial es manual.

## 11. Etapas

Cada etapa termina con algo que se puede probar en el navegador y en el celular. Hacer commit al cerrar cada una.

### Fase F · Frontend con API de prueba
1. **F1 · Proyecto base.** Next.js, TypeScript, Tailwind con tokens de color y fuentes, componentes base (Button, Input, Select, Textarea, Card, Badge, Switch, Modal/Sheet, Toast, Skeleton), layout de tienda y layout de panel responsive. *Listo cuando:* `/dev/componentes` muestra todo en 390 y 1440 px.
2. **F2 · Contrato y API de prueba.** Tipos de la sección 4, datos de la sección 6, base de datos en memoria, route handlers de `app/api/mock/`, `apiFetch`, los `api.ts` de cada feature, utilidades de `shared/lib/` (`formatSoles`, fechas, teléfonos) y `buildWhatsAppMessage` con pruebas. Estructura de carpetas de la sección 2 creada. Reglas de la sección 7 en la API de prueba, con pruebas. *Listo cuando:* las pruebas pasan y cada endpoint responde con los datos de prueba.
3. **F3 · Catálogo y producto.** `/[slug]` y `/[slug]/p/[productId]`, categorías, buscador, badges de stock, selector de opciones con agotados tachados, guía de tallas, campos extra, Open Graph. *Listo cuando:* las tres tiendas se ven bien y cada una muestra solo lo que tiene activado.
4. **F4 · Carrito, checkout y WhatsApp.** Carrito persistente, checkout que muestra solo las entregas y fechas activas, `createOrder`, manejo de `out_of_stock` y errores de validación, página de pedido listo y apertura de WhatsApp. *Listo cuando:* desde el celular se crea un pedido, se abre WhatsApp con el mensaje y el pedido aparece en el panel.
5. **F5 · Registro y configuración.** Flujo de registro con verificación de slug y las 4 preguntas, configuración de datos, funciones, zonas y métodos de pago. *Listo cuando:* desactivar una función la quita del catálogo y del checkout.
6. **F6 · Productos.** Lista, crear y editar: fotos con compresión, categoría, opciones con sugerencias y opción propia, generación de combinaciones con precio y stock, campos extra, por encargo, visible. *Listo cuando:* se crea un producto con 3 tallas × 2 colores y cada combinación tiene su stock.
7. **F7 · Pedidos y stock.** Panel de pedidos por estado, detalle con stock reservado, cambios de estado, botón para escribir al cliente, ajuste rápido de stock, historial de movimientos, alertas de stock bajo. *Listo cuando:* un pedido recorre de Nuevo a Entregado y el stock cambia según la sección 7.
8. **F8 · Computadora, landing y planes.** Métricas, lo más vendido, tabla de inventario con panel lateral, landing, página de plan y candados. Playwright: flujo de compra completo y capturas de todas las pantallas en 390 y 1440 px.

### Fase B · Backend real
9. **B1 · Proyecto FastAPI.** Estructura de módulos (sección 12), `shared/` (unidad de trabajo, `CamelModel`, errores, bus de eventos), conexión a PostgreSQL, CORS y Swagger en `/docs`. *Listo cuando:* `/docs` muestra un endpoint de prueba que responde en `camelCase` y los errores salen con el formato `{ error, message }`.
10. **B2 · Base de datos y dominio.** Tablas de cada módulo, restricciones, índices y migraciones. Agregados `Order` y `StockItem` con pruebas unitarias (sin base de datos). Los mismos datos de prueba de la sección 6.
11. **B3 · Autenticación y permisos.** Login del dueño (link mágico al correo y Google) y aislamiento por tienda.
12. **B4 · Endpoints públicos y pedidos.** Catálogo, producto, crear pedido con reserva atómica, pedido por token. Prueba de concurrencia.
13. **B5 · Endpoints del panel.** Tienda, productos, pedidos, estados, stock, historial, métricas, vencimiento programado.
14. **B6 · Imágenes y planes.** Almacenamiento de imágenes con permisos por tienda y límites de planes en el servidor.

### Fase C · Conexión
15. **C1 · Verificar el contrato.** Generar tipos de TypeScript desde el OpenAPI del backend (`npx openapi-typescript <url>/openapi.json -o shared/types/generated.ts`) y compararlos con `shared/types/`. Corregir cualquier diferencia antes de conectar.
16. **C2 · Autenticación real.** Pantallas de `/ingresar` y `/registro` contra el backend y `authHeaders()` con el token real.
17. **C3 · Cambiar el link.** `NEXT_PUBLIC_API_URL` apunta al backend. Probar módulo por módulo: catálogo, pedidos, productos, stock.
18. **C4 · Limpieza y despliegue.** Eliminar `mocks/` y `app/api/mock/`, ejecutar Playwright contra el backend real, desplegar front y back.

## 12. Requisitos del backend (fase B)

### Arquitectura del backend: monolito modular con DDD donde importa

Un solo servicio FastAPI dividido en **módulos por contexto del negocio**. Cada módulo es dueño de sus tablas y de sus reglas. Se usa DDD solo donde hay reglas que proteger; el resto son capas simples.

| Módulo | Qué maneja | Nivel | Tablas propias |
| --- | --- | --- | --- |
| `ordering` | Pedidos, ítems, estados y transiciones | DDD | `orders`, `order_items` |
| `inventory` | Stock, reservas, movimientos, alertas | DDD | `stock_items`, `stock_movements` |
| `catalog` | Productos, opciones, variantes, campos extra, categorías, imágenes | Intermedio | `products`, `product_images`, `product_options`, `option_values`, `variants`, `variant_option_values`, `custom_fields`, `categories` |
| `stores` | Tienda, configuración, funciones, zonas, miembros | Simple | `stores`, `delivery_zones`, `store_members` |
| `subscriptions` | Planes y límites | Simple | `subscriptions` |
| `iam` | Usuarios, sesión, `get_current_user()`, `get_current_store()` | Simple | `users` |
| `reporting` | Métricas del panel | Solo lectura | ninguna |

**Estructura:**

```
backend/
├── app/
│   ├── main.py                  # crea la app: CORS, manejo de errores, routers de cada módulo
│   ├── config.py                # pydantic-settings (.env)
│   ├── shared/
│   │   ├── db.py                # motor, sesión y unidad de trabajo (una transacción por petición)
│   │   ├── schemas.py           # CamelModel: base de todos los esquemas (camelCase)
│   │   ├── errors.py            # DomainError y manejador global → { error, message }
│   │   ├── events.py            # bus de eventos en proceso
│   │   └── domain/              # value objects comunes: Money, PhoneNumber, Slug
│   ├── modules/
│   │   ├── ordering/            # DDD
│   │   │   ├── domain/          # Order (agregado), OrderItem, OrderStatus, eventos, reglas
│   │   │   ├── application/     # casos de uso: place_order, confirm_payment, start_preparing,
│   │   │   │                    #   deliver, cancel_order, expire_orders
│   │   │   ├── infrastructure/  # modelos SQLAlchemy y OrderRepository
│   │   │   ├── interfaces/      # router.py (FastAPI) y schemas.py (contrato)
│   │   │   └── public.py        # lo único que otros módulos pueden usar
│   │   ├── inventory/           # DDD, misma estructura que ordering
│   │   ├── catalog/             # router.py, schemas.py, service.py, models.py,
│   │   │                        #   domain/variants.py (generar combinaciones), public.py
│   │   ├── stores/              # router.py, schemas.py, service.py, models.py, public.py
│   │   ├── subscriptions/       # igual que stores
│   │   ├── iam/                 # igual que stores + dependencies.py
│   │   └── reporting/           # router.py, queries.py (solo lectura)
│   └── jobs/                    # vencer reservas cada 15 minutos
├── migrations/                  # Alembic
├── tests/
│   ├── unit/                    # dominio puro, sin base de datos
│   ├── integration/             # casos de uso con base de datos de prueba
│   ├── api/                     # endpoints y contrato camelCase
│   └── concurrency/             # pedidos simultáneos por la última unidad
├── seed.py                      # las tres tiendas de prueba (sección 6)
├── pyproject.toml
└── Dockerfile
```

**Capas dentro de un módulo DDD:**

| Capa | Responsabilidad | Nunca hace |
| --- | --- | --- |
| `domain/` | Agregados, value objects, eventos y reglas. Python puro. | Importar FastAPI, SQLAlchemy ni otros módulos |
| `application/` | Casos de uso: abre la unidad de trabajo, carga agregados, llama sus métodos, guarda y publica eventos | Reglas de negocio propias (las delega al dominio) |
| `infrastructure/` | Modelos de SQLAlchemy y repositorios | Reglas de negocio |
| `interfaces/` | Router de FastAPI y esquemas Pydantic (el contrato) | SQL ni reglas de negocio |

En los módulos simples: `router.py` → `service.py` → `models.py`. El router valida y responde; el servicio tiene la lógica; los modelos son las tablas.

**Reglas entre módulos:**
1. Un módulo usa otro solo a través de su `public.py`. Nunca importa sus modelos, repositorios ni dominio.
2. Cada módulo escribe solo en sus propias tablas. Las consultas que cruzan módulos solo existen en `reporting`, y son de solo lectura.
3. Los eventos de dominio se despachan en el mismo proceso y de forma síncrona, dentro de la misma transacción y antes del commit. Si un manejador falla, se deshace todo.
4. Todos los routers `/me/*` usan `get_current_store()` de `iam`, y toda consulta filtra por esa tienda.

**Agregados y value objects:**
- `Order` (ordering): métodos `confirm_payment()`, `start_preparing()`, `deliver()`, `cancel()`, `expire()`. Una transición no permitida lanza `InvalidTransition` (HTTP 409). Calcula sus totales con `Money`.
- `StockItem` (inventory): `on_hand`, `reserved`, `low_stock_threshold`, `version`. Métodos `reserve()`, `release()`, `commit_sale()`, `restock()`, `adjust()`. Garantiza `0 <= reserved <= on_hand`.
- Value objects: `Money` (céntimos), `PhoneNumber` (formato peruano), `Slug`, `OrderNumber`, `Address`.

**Eventos:**

| Evento | Lo emite | Reacción |
| --- | --- | --- |
| `OrderPlaced` | ordering | inventory reserva cada ítem con stock; si falta, lanza `OutOfStock` y se deshace el pedido |
| `PaymentConfirmed` | ordering | inventory convierte la reserva en venta |
| `OrderCancelled` | ordering | inventory libera la reserva (si estaba Nuevo) o devuelve el stock (si estaba Pagado o Preparando) |
| `OrderExpired` | ordering | inventory libera la reserva |

**Flujo "crear pedido":** `POST /public/orders` → `ordering/interfaces/router.py` valida con `CreateOrderInput` → `application/place_order()` obtiene precios y opciones con `catalog.public`, valida las funciones activas con `stores.public`, crea el agregado `Order` y lo guarda → publica `OrderPlaced` → inventory reserva con el `UPDATE` atómico y registra los movimientos → commit → responde un `PublicOrder` en `camelCase`.

**Lo común a todos los módulos:**
- **camelCase:** todos los esquemas heredan de `CamelModel` (`alias_generator=to_camel`, `populate_by_name=True`) y los endpoints responden con los alias. En Python se escribe `price_cents`; en el JSON sale `priceCents`.
- **Errores:** `DomainError` y sus subclases (`InvalidTransition`, `OutOfStock`, `NotFound`, `LimitReached`) se convierten en `{ error, message }` con el código HTTP de la sección 5.
- **CORS:** permitir el dominio del front (y `localhost:3000` en desarrollo), con credenciales.
- **Swagger:** en `/docs`; el esquema en `/openapi.json` se usa en la etapa C1.
- **Rutas:** las mismas de la sección 5, sin prefijo adicional. La columna "Módulo" indica qué módulo implementa cada endpoint.

### Tablas

Las tablas reflejan los tipos de la sección 4, repartidas por módulo según la tabla anterior. Columnas internas importantes:
- `stores`: `owner_id`, `next_order_number`, `active`. `slug` único.
- `variants` (catalog): precio, etiqueta y si está activa. **No** guarda stock.
- `stock_items` (inventory): `variant_id` (clave primaria), `store_id`, `on_hand`, `reserved`, `low_stock_threshold`, `version`. Restricciones `CHECK` para `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`.
- `orders`: `store_id`, `delivery_zone_id`. `(store_id, number)` único.
- `stock_movements`: `store_id`, `variant_id`, `order_id`.
- `subscriptions`: `store_id`, `plan`, `expires_at`.
- Todas las tablas con datos de una tienda tienen `store_id` e índice por él.
- Dinero en céntimos (`integer`). Fechas con zona horaria.

El contrato no cambia: `Variant.available` y los campos de stock de `VariantAdmin` se arman en catalog pidiendo la disponibilidad a `inventory.public`.

### Concurrencia en el stock

**Reservas: `UPDATE` atómico.** Es una excepción consciente al patrón de "cargar, modificar y guardar" del agregado, porque es el punto donde más clientes compiten a la vez:

```sql
update stock_items
set reserved = reserved + :qty
where variant_id = :variant_id
  and on_hand - reserved >= :qty;
-- si no se actualizó ninguna fila: no hay stock suficiente → OutOfStock → se deshace la transacción
```

**Ajustes manuales y demás cambios: bloqueo optimista.** Se carga el `StockItem`, se aplica el método del agregado y se guarda con `WHERE version = :version_leida`, aumentando `version`. Si no se actualizó ninguna fila, alguien cambió el stock al mismo tiempo: se responde 409 y el panel vuelve a cargar los datos.

Todos los cambios de stock registran un `stock_movements` en la misma transacción. El vencimiento de reservas corre en `jobs/` cada 15 minutos y usa el caso de uso `expire_orders`.

### Seguridad
- Un dueño solo puede leer y modificar datos de sus tiendas. Todos los endpoints `/me/*` usan la dependencia `get_current_store()`, y toda consulta del panel filtra por esa tienda.
- Login: link mágico al correo y Google. Se recomienda delegar la verificación de identidad en un servicio administrado y que el backend valide sus tokens, en lugar de manejar contraseñas propias.
- El público solo lee tiendas activas, productos visibles, variantes activas (precio y disponibilidad, no `on_hand` ni `reserved`), campos extra, categorías y zonas activas. No lee pedidos salvo por `public_token`.
- Validación de todas las entradas en el servidor con las reglas de la sección 7.
- Límite de pedidos por IP y por teléfono.
- Imágenes: solo jpg, png y webp, rutas por tienda, escritura solo para miembros de esa tienda.
- Datos del cliente: solo los necesarios para el pedido. Página de privacidad.

## 13. Pruebas mínimas

**Fase F**
- Utilidades: formato de soles, fechas, teléfonos y mensaje de WhatsApp.
- API de prueba: reserva, confirmación, cancelación y vencimiento dejan el stock correcto; transiciones inválidas se rechazan; funciones desactivadas se rechazan.
- Playwright: compra completa en las tres tiendas, en 390 y 1440 px.

**Fase B**
- Concurrencia: 10 pedidos simultáneos por la última unidad, solo 1 pasa.
- Un dueño no puede leer ni modificar datos de otra tienda.
- Precios manipulados desde el navegador se ignoran.
- El historial de movimientos suma lo mismo que el stock actual.

- Cada endpoint responde en `camelCase` con los campos de `shared/types/`.

**Fase C**
- Los tipos generados desde el OpenAPI coinciden con `shared/types/`.
- Las mismas pruebas de Playwright de la fase F pasan contra el backend real.
