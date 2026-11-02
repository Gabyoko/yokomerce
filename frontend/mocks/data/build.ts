import { addDays, todayInLima } from "@/shared/lib/dates";
import { normalizePeruPhone } from "@/shared/lib/phone";
import type { ISODateTime, OrderItem, StockMovementType } from "@/shared/types";

import { applyStockMovement, availableOf } from "../logic/stock";
import type {
  CategoryRecord,
  MockDb,
  OrderRecord,
  ProductRecord,
  StockItemRecord,
  StockMovementRecord,
  StoreRecord,
  VariantRecord,
  ZoneRecord,
} from "../types";
import type { SeedOrder, SeedStore } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** El stock inicial se carga antes del pedido más antiguo (máximo 7 días). */
const INITIAL_STOCK_HOURS_AGO = 8 * 24;

/** Error en los datos de prueba: el mensaje dice qué corregir. */
class SeedError extends Error {
  constructor(store: string, message: string) {
    super(`[datos de prueba · ${store}] ${message}`);
    this.name = "SeedError";
  }
}

/** "Verde oliva" → "verde-oliva", "Tamaño" → "tamano". */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Instante ISO sin milisegundos y redondeado al minuto: "2026-10-29T15:28:00Z". */
function toISODateTime(ms: number): ISODateTime {
  return new Date(Math.floor(ms / MINUTE) * MINUTE).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Token público estable para cada pedido (siempre el mismo con los mismos datos). */
function makeToken(seed: string): string {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  let token = "";
  for (let i = 0; i < 20; i++) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) ^ i;
    token += "abcdefghijkmnpqrstuvwxyz23456789"[(hash >>> 0) % 32];
  }
  return token;
}

type StockEvent = {
  at: number;
  variantId: string;
  type: StockMovementType;
  amount: number;
  reason: string | null;
  createdBy: string | null;
  order: OrderRecord | null;
};

/** Efecto de cada movimiento sobre lo disponible (onHand - reserved). */
const AVAILABLE_EFFECT: Record<Exclude<StockMovementType, "adjust">, number> = {
  reserve: -1,
  release: 1,
  sale: 0,
  in: 1,
  out: -1,
};

/** Convierte los datos de prueba en la base de datos en memoria. Las fechas son relativas a `now`. */
export function buildDatabase(seeds: SeedStore[], now: Date = new Date()): MockDb {
  const db: MockDb = {
    seededAt: toISODateTime(now.getTime()),
    stores: [],
    zones: [],
    categories: [],
    products: [],
    variants: [],
    stockItems: [],
    orders: [],
    movements: [],
  };
  // Copia profunda: la base se modifica en uso y los datos originales deben quedar intactos para resetDb()
  for (const seed of seeds) buildStore(db, structuredClone(seed), now.getTime());
  return db;
}

function buildStore(db: MockDb, seed: SeedStore, now: number) {
  const { idPrefix: p, store: s } = seed;
  const fail = (message: string): never => {
    throw new SeedError(s.slug, message);
  };

  // --- Tienda, zonas y categorías ---
  const { planExpiresInDays, ...storeFields } = s;
  const store: StoreRecord = {
    ...storeFields,
    id: `st_${p}`,
    planExpiresAt: planExpiresInDays === null ? null : toISODateTime(now + planExpiresInDays * 24 * HOUR),
    ownerName: seed.ownerName,
    nextOrderNumber: seed.firstOrderNumber + seed.orders.length,
  };
  if (!s.features.deliveryZones && !s.features.pickup && !s.features.shipping) {
    fail("al menos un tipo de entrega debe estar activo");
  }
  db.stores.push(store);

  const zones: ZoneRecord[] = seed.zones.map((zone) => ({
    id: `zn_${p}_${slugify(zone.name)}`,
    storeId: store.id,
    name: zone.name,
    priceCents: zone.priceCents,
    active: zone.active ?? true,
  }));
  db.zones.push(...zones);

  const categories: CategoryRecord[] = seed.categories.map((name, position) => ({
    id: `ct_${p}_${slugify(name)}`,
    storeId: store.id,
    name,
    position,
  }));
  db.categories.push(...categories);

  // --- Productos y variantes ---
  const productsByKey = new Map<string, ProductRecord>();
  const variantsByKey = new Map<string, VariantRecord>();
  const stockItems = new Map<string, StockItemRecord>();
  const targetAvailable = new Map<string, number>();
  const variantKey = (productKey: string, values: string[] = []) => `${productKey}|${values.join("|")}`;

  seed.products.forEach((sp, position) => {
    const productId = `pr_${p}_${sp.key}`;
    const category = categories.find((c) => c.name === sp.category) ?? fail(`categoría "${sp.category}" no existe`);
    const madeToOrder = sp.madeToOrder ?? false;
    if (madeToOrder && !s.features.madeToOrder) fail(`${sp.key} es por encargo pero la función está apagada`);
    if (sp.sizeGuideUrl && !s.features.sizeGuide) fail(`${sp.key} tiene guía de tallas pero la función está apagada`);
    if ((sp.options?.length ?? 0) > 3) fail(`${sp.key} tiene más de 3 opciones`);

    const options = (sp.options ?? []).map((option) => {
      const optionId = `op_${p}_${sp.key}_${slugify(option.name)}`;
      return {
        id: optionId,
        name: option.name,
        values: option.values.map((value) => ({ id: `${optionId}_${slugify(value)}`, value })),
      };
    });

    const product: ProductRecord = {
      id: productId,
      storeId: store.id,
      categoryId: category.id,
      name: sp.name,
      description: sp.description,
      images: sp.images ?? [],
      madeToOrder,
      sizeGuideUrl: sp.sizeGuideUrl ?? null,
      visible: sp.visible ?? true,
      position,
      options,
      customFields: (sp.customFields ?? []).map((field) => ({ ...field, id: `cf_${p}_${sp.key}_${slugify(field.label)}` })),
    };
    db.products.push(product);
    productsByKey.set(sp.key, product);

    if (sp.variants.length === 0) fail(`${sp.key} no tiene variantes`);
    sp.variants.forEach((sv, variantPosition) => {
      if (sv.values.length !== options.length) fail(`${sp.key}: la variante [${sv.values}] no coincide con sus opciones`);
      const optionValueIds = sv.values.map(
        (value, i) =>
          options[i]?.values.find((v) => v.value === value)?.id ?? fail(`${sp.key}: el valor "${value}" no existe`),
      );
      const variant: VariantRecord = {
        id: sv.values.length === 0 ? `va_${p}_${sp.key}` : `va_${p}_${sp.key}_${sv.values.map(slugify).join("_")}`,
        productId,
        storeId: store.id,
        optionValueIds,
        label: sv.values.join(" / "),
        priceCents: sv.priceCents,
        active: sv.active ?? true,
        position: variantPosition,
      };
      if (variantsByKey.has(variantKey(sp.key, sv.values))) fail(`${sp.key}: variante repetida [${sv.values}]`);
      if (madeToOrder && sv.available !== 0) fail(`${sp.key} es por encargo: su stock debe ser 0`);
      db.variants.push(variant);
      variantsByKey.set(variantKey(sp.key, sv.values), variant);
      stockItems.set(variant.id, {
        variantId: variant.id,
        storeId: store.id,
        onHand: 0,
        reserved: 0,
        lowStockThreshold: sv.lowStockThreshold ?? null,
      });
      targetAvailable.set(variant.id, sv.available);
    });
  });

  const findVariant = (productKey: string, values?: string[]) => {
    const product = productsByKey.get(productKey) ?? fail(`producto "${productKey}" no existe`);
    const variant =
      variantsByKey.get(variantKey(productKey, values)) ?? fail(`${productKey}: variante [${values ?? ""}] no existe`);
    return { product, variant };
  };

  // --- Pedidos ---
  const events: StockEvent[] = [];
  const at = (ms: number, label: string) => (ms <= now ? ms : fail(`${label} queda en el futuro`));

  seed.orders.forEach((so, index) => {
    const number = seed.firstOrderNumber + index;
    const label = `pedido #${number}`;
    const created = now - so.hoursAgo * HOUR;
    if (so.hoursAgo > 7 * 24) fail(`${label} tiene más de 7 días`);
    if (index > 0 && so.hoursAgo > (seed.orders[index - 1] as SeedOrder).hoursAgo) {
      fail(`${label} está fuera de orden cronológico`);
    }

    const reservedUntil = created + s.reservationHours * HOUR;
    if (so.status === "new" && reservedUntil <= now) fail(`${label} es nuevo pero su reserva ya venció`);
    if (so.status === "expired" && reservedUntil > now) fail(`${label} está vencido pero su reserva sigue vigente`);

    const wasPaid =
      so.status === "paid" ||
      so.status === "preparing" ||
      so.status === "delivered" ||
      (so.status === "cancelled" && so.cancelledFrom === "paid");
    const paidAt = wasPaid ? at(created + (so.paidAfterMinutes ?? 30) * MINUTE, `${label}: el pago`) : null;
    const deliverAt = so.deliverAfterHours === undefined ? null : created + so.deliverAfterHours * HOUR;
    const deliveredAt = so.status === "delivered" ? at(deliverAt ?? fail(`${label} entregado sin deliverAfterHours`), `${label}: la entrega`) : null;
    const cancelledAt =
      so.status === "cancelled" ? at((paidAt ?? created) + 2 * HOUR, `${label}: la cancelación`) : null;
    if (so.status === "cancelled" && !so.cancelledFrom) fail(`${label} cancelado sin cancelledFrom`);

    // Fecha de entrega: solo si la función está activa, respetando los días de anticipación
    let deliveryDate: string | null = null;
    if (s.features.deliveryDate) {
      if (deliverAt === null) fail(`${label} necesita deliverAfterHours (la tienda usa fecha de entrega)`);
      deliveryDate = todayInLima(new Date(deliverAt as number));
      if (deliveryDate < addDays(todayInLima(new Date(created)), s.features.leadTimeDays)) {
        fail(`${label} no respeta los ${s.features.leadTimeDays} días de anticipación`);
      }
    }

    // Entrega
    const f = so.fulfillment;
    let zone: ZoneRecord | null = null;
    let deliveryFeeCents: number | null;
    if (f.type === "delivery") {
      if (!s.features.deliveryZones) fail(`${label} usa delivery pero la tienda no tiene zonas`);
      zone = zones.find((z) => z.name === f.zone && z.active) ?? fail(`${label}: zona "${f.zone}" no existe o no está activa`);
      if (!f.address) fail(`${label}: falta la dirección`);
      deliveryFeeCents = zone.priceCents;
    } else if (f.type === "pickup") {
      if (!s.features.pickup) fail(`${label} usa recojo pero la función está apagada`);
      deliveryFeeCents = 0;
    } else {
      if (!s.features.shipping) fail(`${label} usa envío pero la función está apagada`);
      if (!f.city || !f.address) fail(`${label}: el envío necesita ciudad y dirección`);
      deliveryFeeCents = s.shippingFeeCents;
    }

    if (!s.paymentMethods.includes(so.paymentMethod)) fail(`${label}: la tienda no acepta ${so.paymentMethod}`);
    const phone = normalizePeruPhone(so.customer.phone) ?? fail(`${label}: celular inválido`);
    const name = so.customer.name.trim();
    if (name.length < 2 || name.length > 60) fail(`${label}: el nombre debe tener de 2 a 60 caracteres`);

    // Ítems con precios tomados de la variante (nunca del pedido)
    const resolved = so.items.map((item) => {
      const { product, variant } = findVariant(item.product, item.variant);
      if (!variant.active) fail(`${label}: la variante ${variant.id} no está activa`);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        fail(`${label}: cantidad inválida`);
      }
      const customValues = item.customValues ?? {};
      for (const field of product.customFields) {
        const value = customValues[field.label]?.trim() ?? "";
        if (field.required && !value) fail(`${label}: falta "${field.label}"`);
        if (value.length > field.maxLength) fail(`${label}: "${field.label}" pasa de ${field.maxLength} letras`);
      }
      for (const key of Object.keys(customValues)) {
        if (!product.customFields.some((field) => field.label === key)) fail(`${label}: campo extra "${key}" no existe`);
      }
      const orderItem: OrderItem = {
        variantId: variant.id,
        productName: product.name,
        variantLabel: variant.label,
        unitPriceCents: variant.priceCents,
        quantity: item.quantity,
        lineTotalCents: variant.priceCents * item.quantity,
        customValues,
        tracksStock: !product.madeToOrder,
      };
      return orderItem;
    });

    const subtotalCents = resolved.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const order: OrderRecord = {
      id: `or_${p}_${number}`,
      storeId: store.id,
      deliveryZoneId: zone?.id ?? null,
      number,
      publicToken: makeToken(`${p}-${number}`),
      status: so.status,
      customer: { name, phone },
      fulfillment: {
        type: f.type,
        zoneName: zone?.name ?? null,
        city: f.type === "shipping" ? (f.city ?? null) : null,
        address: f.type === "pickup" ? null : (f.address ?? null),
        reference: f.type === "pickup" ? null : (f.reference ?? null),
      },
      deliveryDate,
      paymentMethod: so.paymentMethod,
      items: resolved,
      subtotalCents,
      deliveryFeeCents,
      totalCents: subtotalCents + (deliveryFeeCents ?? 0),
      reservedUntil: toISODateTime(reservedUntil),
      createdAt: toISODateTime(created),
      paidAt: paidAt === null ? null : toISODateTime(paidAt),
      deliveredAt: deliveredAt === null ? null : toISODateTime(deliveredAt),
      cancelledAt: cancelledAt === null ? null : toISODateTime(cancelledAt),
      notes: so.notes ?? null,
    };
    db.orders.push(order);

    // Movimientos de stock del pedido (SPEC.md, sección 7)
    for (const item of resolved.filter((i) => i.tracksStock)) {
      const base = { variantId: item.variantId, amount: item.quantity, order };
      events.push({ ...base, at: created, type: "reserve", reason: null, createdBy: null });
      if (paidAt !== null) events.push({ ...base, at: paidAt, type: "sale", reason: null, createdBy: seed.ownerName });
      if (cancelledAt !== null) {
        events.push(
          paidAt === null
            ? { ...base, at: cancelledAt, type: "release", reason: "cancelacion", createdBy: seed.ownerName }
            : { ...base, at: cancelledAt, type: "in", reason: "cancelacion", createdBy: seed.ownerName },
        );
      }
      if (so.status === "expired") {
        events.push({ ...base, at: reservedUntil, type: "release", reason: null, createdBy: null });
      }
    }
  });

  for (const adj of seed.adjustments ?? []) {
    const { product, variant } = findVariant(adj.product, adj.variant);
    if (product.madeToOrder) fail(`${adj.product} es por encargo: no lleva movimientos de stock`);
    events.push({
      at: now - adj.hoursAgo * HOUR,
      variantId: variant.id,
      type: adj.type,
      amount: adj.quantity,
      reason: adj.reason,
      createdBy: seed.ownerName,
      order: null,
    });
  }

  // --- Stock inicial: lo justo para terminar con el disponible pedido en los datos ---
  const initialAt = now - INITIAL_STOCK_HOURS_AGO * HOUR;
  for (const [variantId, target] of targetAvailable) {
    const own = events.filter((e) => e.variantId === variantId).sort((a, b) => a.at - b.at);
    let running = 0;
    let lowest = 0;
    for (const event of own) {
      running += AVAILABLE_EFFECT[event.type as keyof typeof AVAILABLE_EFFECT] * event.amount;
      lowest = Math.min(lowest, running);
    }
    const initial = target - running;
    if (initial + lowest < 0) fail(`${variantId}: con ${target} disponibles al final, el stock queda negativo en algún momento`);
    if (initial > 0) {
      events.push({ at: initialAt, variantId, type: "in", amount: initial, reason: null, createdBy: seed.ownerName, order: null });
    }
  }

  // --- Aplicar todos los movimientos en orden, con las mismas reglas que usará la API ---
  const movements: StockMovementRecord[] = [];
  events
    .sort((a, b) => a.at - b.at)
    .forEach((event) => {
      const current = stockItems.get(event.variantId) as StockItemRecord;
      const { item, signedQuantity } = applyStockMovement(current, event.type, event.amount);
      stockItems.set(event.variantId, item);
      movements.push({
        id: `mv_${p}_${movements.length + 1}`,
        storeId: store.id,
        variantId: event.variantId,
        orderId: event.order?.id ?? null,
        orderNumber: event.order?.number ?? null,
        type: event.type,
        quantity: signedQuantity,
        reason: event.reason,
        createdBy: event.createdBy,
        createdAt: toISODateTime(event.at),
      });
    });

  for (const [variantId, target] of targetAvailable) {
    const item = stockItems.get(variantId) as StockItemRecord;
    if (availableOf(item) !== target) fail(`${variantId}: terminó con ${availableOf(item)} disponibles y no ${target}`);
  }

  db.stockItems.push(...stockItems.values());
  db.movements.push(...movements);
}
