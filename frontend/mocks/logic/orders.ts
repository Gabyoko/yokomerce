import { addDays, isValidISODate, todayInLima, weekdayOf } from "@/shared/lib/dates";
import { normalizePeruPhone } from "@/shared/lib/phone";
import type {
  CreateOrderResult,
  FulfillmentType,
  ISODateTime,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PublicOrder,
} from "@/shared/types";

import type { MockDb, OrderRecord, StoreRecord, ZoneRecord } from "../types";
import { isMadeToOrder } from "./catalog";
import { badRequest, conflict, notFound } from "./errors";
import { availableOf, getStockItem, recordStockMovement } from "./stock";
import { findStoreBySlug } from "./stores";

/*
 * Reglas de pedidos de SPEC.md, sección 7. El precio, los totales y el stock los decide
 * siempre esta lógica a partir de los datos guardados; nunca se usa lo que manda el navegador.
 */

export const MAX_QUANTITY = 99;
export const ORDERS_PER_HOUR_PER_PHONE = 5;
const NAME_LENGTH = { min: 2, max: 60 };
const ADDRESS_MAX = 200;
const REFERENCE_MAX = 200;
const CITY_MAX = 60;

const PAYMENT_METHODS: PaymentMethod[] = ["yape", "plin", "cash", "transfer"];
const FULFILLMENT_TYPES: FulfillmentType[] = ["delivery", "pickup", "shipping"];

const toISODateTime = (date: Date): ISODateTime => date.toISOString().replace(/\.\d{3}Z$/, "Z");

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Lo que ve el cliente: sin id interno ni notas del negocio. */
export function toPublicOrder(order: OrderRecord): PublicOrder {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, notes, storeId, deliveryZoneId, ...publicOrder } = order;
  return publicOrder;
}

/** Pedido como lo ve el dueño. */
export function toOrder(order: OrderRecord): Order {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { storeId, deliveryZoneId, ...rest } = order;
  return rest;
}

/** GET /public/stores/:slug/orders/:token */
export function getPublicOrder(db: MockDb, slug: string, token: string): PublicOrder {
  const store = findStoreBySlug(db, slug);
  const order = db.orders.find((o) => o.storeId === store.id && o.publicToken === token);
  if (!order) throw notFound("No encontramos este pedido.");
  return toPublicOrder(order);
}

// ---------------------------------------------------------------------------
// Crear pedido
// ---------------------------------------------------------------------------

type Fields = Record<string, string>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Ítem ya validado, con su producto y variante. */
type ValidItem = { item: OrderItem; madeToOrder: boolean };

type ValidOrder = {
  store: StoreRecord;
  items: ValidItem[];
  customer: { name: string; phone: string };
  fulfillment: Order["fulfillment"];
  zone: ZoneRecord | null;
  deliveryFeeCents: number | null;
  deliveryDate: string | null;
  paymentMethod: PaymentMethod;
};

/**
 * Revisa todo el pedido y junta los errores por campo, para mostrarlos juntos en el formulario.
 * Las claves siguen la forma del input: "customer.phone", "items.0.quantity", "fulfillment.zoneId"...
 */
function validateOrder(
  db: MockDb,
  input: Record<string, unknown>,
  store: StoreRecord,
  now: Date,
): { ok: true; order: ValidOrder } | { ok: false; fields: Fields } {
  const fields: Fields = {};
  const { features } = store;

  // Cliente
  const customer = isObject(input.customer) ? input.customer : {};
  const name = text(customer.name);
  if (name.length < NAME_LENGTH.min || name.length > NAME_LENGTH.max) {
    fields["customer.name"] = `Escribe tu nombre (de ${NAME_LENGTH.min} a ${NAME_LENGTH.max} letras).`;
  }
  const phone = normalizePeruPhone(text(customer.phone));
  if (!phone) fields["customer.phone"] = "Escribe un celular de 9 dígitos que empiece con 9.";

  // Pago
  const paymentMethod = input.paymentMethod as PaymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod) || !store.paymentMethods.includes(paymentMethod)) {
    fields.paymentMethod = "Elige un método de pago que acepte la tienda.";
  }

  // Entrega: solo los tipos activos en la tienda
  const f = isObject(input.fulfillment) ? input.fulfillment : {};
  const type = f.type as FulfillmentType;
  const typeEnabled =
    (type === "delivery" && features.deliveryZones) ||
    (type === "pickup" && features.pickup) ||
    (type === "shipping" && features.shipping);
  let zone: ZoneRecord | null = null;
  let deliveryFeeCents: number | null = 0;
  const address = text(f.address);
  const reference = text(f.reference);
  const city = text(f.city);

  if (!FULFILLMENT_TYPES.includes(type) || !typeEnabled) {
    fields["fulfillment.type"] = "Elige una forma de entrega que ofrezca la tienda.";
  } else if (type === "delivery") {
    zone = db.zones.find((z) => z.id === f.zoneId && z.storeId === store.id && z.active) ?? null;
    if (!zone) fields["fulfillment.zoneId"] = "Elige tu distrito.";
    else deliveryFeeCents = zone.priceCents;
  } else if (type === "shipping") {
    if (!city || city.length > CITY_MAX) fields["fulfillment.city"] = "Escribe tu ciudad.";
    deliveryFeeCents = store.shippingFeeCents;
  }
  if (type === "delivery" || type === "shipping") {
    if (!address || address.length > ADDRESS_MAX) fields["fulfillment.address"] = "Escribe la dirección de entrega.";
  }
  if (reference.length > REFERENCE_MAX) fields["fulfillment.reference"] = "La referencia es muy larga.";

  // Fecha de entrega: solo si la función está activa
  let deliveryDate: string | null = null;
  if (features.deliveryDate) {
    const date = text(input.deliveryDate);
    const earliest = addDays(todayInLima(now), features.leadTimeDays);
    if (!isValidISODate(date)) {
      fields.deliveryDate = "Elige el día de entrega.";
    } else if (date < earliest) {
      fields.deliveryDate =
        features.leadTimeDays > 0
          ? `Pide con al menos ${features.leadTimeDays} ${features.leadTimeDays === 1 ? "día" : "días"} de anticipación.`
          : "Elige una fecha desde hoy.";
    } else if (store.businessHours[weekdayOf(date)] === null) {
      fields.deliveryDate = "La tienda no atiende ese día.";
    } else {
      deliveryDate = date;
    }
  } else if (input.deliveryDate !== undefined && input.deliveryDate !== null) {
    fields.deliveryDate = "Esta tienda no permite elegir fecha de entrega.";
  }

  // Ítems: precios y datos tomados de lo guardado
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) fields.items = "Tu carrito está vacío.";
  const items: ValidItem[] = [];

  rawItems.forEach((raw: unknown, index) => {
    const key = `items.${index}`;
    const entry = isObject(raw) ? raw : {};
    const variant = db.variants.find((v) => v.id === entry.variantId && v.storeId === store.id);
    const product = variant && db.products.find((p) => p.id === variant.productId);
    if (!variant || !product || !product.visible || !variant.active) {
      fields[`${key}.variantId`] = "Este producto ya no está disponible.";
      return;
    }

    const quantity = entry.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      fields[`${key}.quantity`] = `La cantidad debe ser de 1 a ${MAX_QUANTITY}.`;
    }

    const rawValues = isObject(entry.customValues) ? entry.customValues : {};
    const customValues: Record<string, string> = {};
    for (const field of product.customFields) {
      const value = text(rawValues[field.label]);
      if (field.required && !value) fields[`${key}.customValues.${field.label}`] = `Completa "${field.label}".`;
      else if (value.length > field.maxLength) {
        fields[`${key}.customValues.${field.label}`] = `Máximo ${field.maxLength} letras.`;
      } else if (value) customValues[field.label] = value;
    }
    for (const label of Object.keys(rawValues)) {
      if (!product.customFields.some((field) => field.label === label)) {
        fields[`${key}.customValues.${label}`] = "Este campo no existe en el producto.";
      }
    }

    const madeToOrder = isMadeToOrder(product, store);
    const validQuantity = typeof quantity === "number" ? quantity : 0;
    items.push({
      madeToOrder,
      item: {
        variantId: variant.id,
        productName: product.name,
        variantLabel: variant.label,
        unitPriceCents: variant.priceCents,
        quantity: validQuantity,
        lineTotalCents: variant.priceCents * validQuantity,
        customValues,
        tracksStock: !madeToOrder,
      },
    });
  });

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return {
    ok: true,
    order: {
      store,
      items,
      customer: { name, phone: phone as string },
      fulfillment: {
        type,
        zoneName: zone?.name ?? null,
        city: type === "shipping" ? city : null,
        address: type === "pickup" ? null : address,
        reference: type === "pickup" || !reference ? null : reference,
      },
      zone,
      deliveryFeeCents,
      deliveryDate,
      paymentMethod,
    },
  };
}

/** Pedidos creados con este celular en la última hora (en todas las tiendas). */
function ordersInLastHour(db: MockDb, phone: string, now: Date): number {
  const since = now.getTime() - 60 * 60_000;
  return db.orders.filter((o) => o.customer.phone === phone && new Date(o.createdAt).getTime() > since).length;
}

/** Unidades pedidas por variante (una variante puede venir en varias líneas). */
function quantitiesByVariant(items: ValidItem[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { item } of items.filter((i) => i.item.tracksStock)) {
    totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity);
  }
  return totals;
}

/**
 * POST /public/orders
 * Valida, revisa el stock de todo el pedido y, solo si todo alcanza, lo crea y reserva el stock.
 * Si algo falla no se crea nada.
 */
export function createOrder(db: MockDb, input: unknown, now: Date = new Date()): CreateOrderResult {
  if (!isObject(input)) return { ok: false, error: "validation", fields: { body: "El pedido no es válido." } };
  const store = findStoreBySlug(db, text(input.storeSlug));

  const validation = validateOrder(db, input, store, now);
  if (!validation.ok) return { ok: false, error: "validation", fields: validation.fields };
  const valid = validation.order;

  if (ordersInLastHour(db, valid.customer.phone, now) >= ORDERS_PER_HOUR_PER_PHONE) {
    return { ok: false, error: "rate_limited" };
  }

  const requested = quantitiesByVariant(valid.items);
  const shortages = [...requested]
    .map(([variantId, quantity]) => ({ variantId, quantity, available: availableOf(getStockItem(db, variantId)) }))
    .filter((s) => s.available < s.quantity)
    .map(({ variantId, available }) => ({ variantId, available }));
  if (shortages.length > 0) return { ok: false, error: "out_of_stock", items: shortages };

  const items = valid.items.map((i) => i.item);
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const order: OrderRecord = {
    id: `or_${crypto.randomUUID()}`,
    storeId: store.id,
    deliveryZoneId: valid.zone?.id ?? null,
    number: store.nextOrderNumber,
    publicToken: crypto.randomUUID().replaceAll("-", ""),
    status: "new",
    customer: valid.customer,
    fulfillment: valid.fulfillment,
    deliveryDate: valid.deliveryDate,
    paymentMethod: valid.paymentMethod,
    items,
    subtotalCents,
    deliveryFeeCents: valid.deliveryFeeCents,
    totalCents: subtotalCents + (valid.deliveryFeeCents ?? 0),
    reservedUntil: toISODateTime(new Date(now.getTime() + store.reservationHours * 60 * 60_000)),
    createdAt: toISODateTime(now),
    paidAt: null,
    deliveredAt: null,
    cancelledAt: null,
    notes: null,
  };

  store.nextOrderNumber += 1;
  db.orders.push(order);
  for (const [variantId, quantity] of requested) {
    recordStockMovement(db, { variantId, type: "reserve", amount: quantity, reason: null, createdBy: null, order, now });
  }

  return { ok: true, order: toPublicOrder(order) };
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

/** new → paid → preparing → delivered; cancelled desde new, paid o preparing; expired desde new. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["paid", "cancelled", "expired"],
  paid: ["preparing", "cancelled"],
  preparing: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  expired: [],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevo",
  paid: "Pagado",
  preparing: "Preparando",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Vencido",
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

function assertTransition(order: OrderRecord, to: OrderStatus) {
  if (!canTransition(order.status, to)) {
    throw conflict(
      "invalid_status",
      `Este pedido está ${STATUS_LABELS[order.status].toLowerCase()} y no se puede pasar a ${STATUS_LABELS[to].toLowerCase()}.`,
    );
  }
}

const trackedItems = (order: OrderRecord) => order.items.filter((item) => item.tracksStock);

/** Busca un pedido de la tienda del dueño. */
export function findOrder(db: MockDb, storeId: string, orderId: string): OrderRecord {
  const order = db.orders.find((o) => o.id === orderId && o.storeId === storeId);
  if (!order) throw notFound("No encontramos este pedido.");
  return order;
}

/**
 * Vence los pedidos nuevos cuya reserva ya pasó y libera su stock.
 * En la fase F se llama al inicio de cada petición a la API de prueba.
 */
export function expireOrders(db: MockDb, now: Date = new Date()): OrderRecord[] {
  const expired = db.orders.filter((o) => o.status === "new" && new Date(o.reservedUntil).getTime() <= now.getTime());
  for (const order of expired) {
    for (const item of trackedItems(order)) {
      recordStockMovement(db, { variantId: item.variantId, type: "release", amount: item.quantity, reason: null, createdBy: null, order, now });
    }
    order.status = "expired";
  }
  return expired;
}

/** Confirmar pago: new → paid. El stock reservado se descuenta (movimiento sale). */
export function confirmPayment(db: MockDb, order: OrderRecord, actor: string, now: Date = new Date()): OrderRecord {
  assertTransition(order, "paid");
  for (const item of trackedItems(order)) {
    recordStockMovement(db, { variantId: item.variantId, type: "sale", amount: item.quantity, reason: null, createdBy: actor, order, now });
  }
  order.status = "paid";
  order.paidAt = toISODateTime(now);
  return order;
}

/** paid → preparing. No mueve stock. */
export function startPreparing(order: OrderRecord): OrderRecord {
  assertTransition(order, "preparing");
  order.status = "preparing";
  return order;
}

/** preparing → delivered. No mueve stock. */
export function markDelivered(order: OrderRecord, now: Date = new Date()): OrderRecord {
  assertTransition(order, "delivered");
  order.status = "delivered";
  order.deliveredAt = toISODateTime(now);
  return order;
}

/**
 * Cancelar. Si estaba nuevo, libera la reserva; si ya estaba pagado o preparándose,
 * devuelve las unidades al stock (movimiento in, motivo "cancelacion").
 */
export function cancelOrder(db: MockDb, order: OrderRecord, actor: string, now: Date = new Date()): OrderRecord {
  assertTransition(order, "cancelled");
  const type = order.status === "new" ? "release" : "in";
  for (const item of trackedItems(order)) {
    recordStockMovement(db, { variantId: item.variantId, type, amount: item.quantity, reason: "cancelacion", createdBy: actor, order, now });
  }
  order.status = "cancelled";
  order.cancelledAt = toISODateTime(now);
  return order;
}

// ---------------------------------------------------------------------------
// Panel: lista y notas
// ---------------------------------------------------------------------------

const ORDER_STATUSES = Object.keys(TRANSITIONS) as OrderStatus[];
const NOTES_MAX = 500;

/** Minúsculas y sin tildes, para buscar "maria" y encontrar "María". */
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * GET /me/orders?status=&search=
 * Más recientes primero. La búsqueda encuentra por nombre del cliente, celular o número ("42", "#0042").
 */
export function listOrders(db: MockDb, storeId: string, params: { status?: string | null; search?: string | null }): Order[] {
  const status = params.status?.trim() || null;
  if (status && !ORDER_STATUSES.includes(status as OrderStatus)) {
    throw badRequest("El estado no es válido.", { fields: { status: "Estado desconocido." } });
  }

  const search = normalize(params.search?.trim() ?? "");
  const digits = search.replace(/\D/g, "");
  const number = /^#?\d+$/.test(search) ? Number(digits) : null;

  return db.orders
    .filter((o) => o.storeId === storeId)
    .filter((o) => !status || o.status === status)
    .filter(
      (o) =>
        !search ||
        normalize(o.customer.name).includes(search) ||
        (digits.length >= 3 && o.customer.phone.includes(digits)) ||
        o.number === number,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number)
    .map(toOrder);
}

/** PATCH /me/orders/:id — nota interna del negocio (el cliente no la ve). */
export function updateOrderNotes(order: OrderRecord, input: unknown): OrderRecord {
  const notes = typeof input === "object" && input !== null ? (input as { notes?: unknown }).notes : undefined;
  if (notes !== null && typeof notes !== "string") {
    throw badRequest("La nota no es válida.", { fields: { notes: "Escribe una nota o déjala vacía." } });
  }
  const clean = notes?.trim() ?? "";
  if (clean.length > NOTES_MAX) throw badRequest("La nota es muy larga.", { fields: { notes: `Máximo ${NOTES_MAX} letras.` } });
  order.notes = clean || null;
  return order;
}
