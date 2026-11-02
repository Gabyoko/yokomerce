import { toWhatsAppNumber } from "@/shared/lib/phone";
import type { DeliveryZone, PaymentMethod, Store, StoreFeatures, Weekday } from "@/shared/types";

import type { MockDb, StoreRecord, ZoneRecord } from "../types";
import { badRequest, notFound } from "./errors";
import { FieldErrors, isInt, isObject, text } from "./validation";

/** SPEC.md, sección 8. */
export const RESERVED_SLUGS = [
  "panel",
  "registro",
  "ingresar",
  "api",
  "admin",
  "planes",
  "ayuda",
  "terminos",
  "privacidad",
  "dev",
] as const;

/** Minúsculas, números y guiones; de 3 a 30 caracteres; sin guion al inicio ni al final. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !slug.includes("--");
}

export function findStoreBySlug(db: MockDb, slug: string): StoreRecord {
  const store = db.stores.find((s) => s.slug === slug);
  if (!store) throw notFound("Esta tienda no existe.");
  return store;
}

/** GET /public/slugs/:slug */
export function checkSlug(db: MockDb, slug: string): { available: boolean } {
  const normalized = slug.trim().toLowerCase();
  const available =
    isValidSlugFormat(normalized) &&
    !(RESERVED_SLUGS as readonly string[]).includes(normalized) &&
    !db.stores.some((s) => s.slug === normalized);
  return { available };
}

/** Quita las columnas internas: lo que ve cualquiera que abra la tienda. */
export function toStore(record: StoreRecord): Store {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ownerName, nextOrderNumber, ...store } = record;
  return store;
}

// ---------------------------------------------------------------------------
// Registro y configuración (panel)
// ---------------------------------------------------------------------------

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PAYMENT_METHODS: PaymentMethod[] = ["yape", "plin", "cash", "transfer"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PRICE_CENTS = 10_000_000;
const LIMITS = { name: 60, description: 300, city: 60, instructions: 300, address: 200, ownerName: 60 };

/** POST /me/store — crea la tienda con las funciones según las 4 preguntas (SPEC.md, sección 3). */
export function createStore(db: MockDb, input: unknown): StoreRecord {
  const body = isObject(input) ? input : {};
  const answers = isObject(body.answers) ? body.answers : {};
  const errors = new FieldErrors();

  const ownerName = text(body.ownerName);
  if (ownerName.length < 2 || ownerName.length > LIMITS.ownerName) errors.add("ownerName", "Escribe tu nombre.");
  const name = text(body.name);
  if (name.length < 2 || name.length > LIMITS.name) errors.add("name", "Escribe el nombre de tu negocio (de 2 a 60 letras).");
  const slug = text(body.slug).toLowerCase();
  if (!checkSlug(db, slug).available) errors.add("slug", "Este link no está disponible. Prueba con otro.");
  const whatsapp = toWhatsAppNumber(text(body.whatsapp));
  if (!whatsapp) errors.add("whatsapp", "Escribe un celular de 9 dígitos que empiece con 9.");
  const city = text(body.city);
  if (!city || city.length > LIMITS.city) errors.add("city", "Escribe tu ciudad o distrito.");
  errors.throwIfAny("Revisa los datos de tu tienda.");

  const madeToOrder = answers.madeToOrder === true;
  const store: StoreRecord = {
    id: `st_${crypto.randomUUID()}`,
    slug,
    name,
    description: "",
    logoUrl: null,
    coverUrl: null,
    city,
    whatsapp: whatsapp as string,
    businessHours: {
      mon: { open: "09:00", close: "19:00" },
      tue: { open: "09:00", close: "19:00" },
      wed: { open: "09:00", close: "19:00" },
      thu: { open: "09:00", close: "19:00" },
      fri: { open: "09:00", close: "19:00" },
      sat: { open: "09:00", close: "19:00" },
      sun: null,
    },
    paymentMethods: ["yape", "cash"],
    paymentInstructions: null,
    features: {
      deliveryDate: answers.deliveryDate === true,
      leadTimeDays: madeToOrder ? 1 : 0,
      madeToOrder,
      sizeGuide: false,
      deliveryZones: false,
      // Siempre hay al menos un tipo de entrega activo
      pickup: true,
      shipping: answers.shipping === true,
    },
    pickupAddress: null,
    shippingFeeCents: null,
    reservationHours: 24,
    plan: "free",
    planExpiresAt: null,
    ownerName,
    nextOrderNumber: 1,
  };
  db.stores.push(store);
  return store;
}

function validateFeatures(value: unknown, current: StoreFeatures, errors: FieldErrors): StoreFeatures {
  if (!isObject(value)) {
    errors.add("features", "Las funciones no son válidas.");
    return current;
  }
  const next = { ...current };
  for (const key of ["deliveryDate", "madeToOrder", "sizeGuide", "deliveryZones", "pickup", "shipping"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "boolean") errors.add(`features.${key}`, "Debe ser sí o no.");
    else next[key] = value[key];
  }
  if (value.leadTimeDays !== undefined) {
    if (!isInt(value.leadTimeDays, 0, 30)) errors.add("features.leadTimeDays", "Escribe de 0 a 30 días.");
    else next.leadTimeDays = value.leadTimeDays;
  }
  if (!next.deliveryZones && !next.pickup && !next.shipping) {
    errors.add("features", "Activa al menos una forma de entrega: delivery, recojo o envío.");
  }
  return next;
}

function validateBusinessHours(value: unknown, errors: FieldErrors): Store["businessHours"] | null {
  if (!isObject(value)) {
    errors.add("businessHours", "El horario no es válido.");
    return null;
  }
  const hours = {} as Store["businessHours"];
  for (const day of WEEKDAYS) {
    const entry = value[day];
    if (entry === null || entry === undefined) {
      hours[day] = null;
      continue;
    }
    const open = isObject(entry) ? text(entry.open) : "";
    const close = isObject(entry) ? text(entry.close) : "";
    if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close) || open >= close) {
      errors.add(`businessHours.${day}`, "La hora de cierre debe ser después de la de apertura.");
    } else {
      hours[day] = { open, close };
    }
  }
  return hours;
}

/** PATCH /me/store — cambia solo los campos que vienen. */
export function updateStore(store: StoreRecord, input: unknown): StoreRecord {
  const body = isObject(input) ? input : {};
  const errors = new FieldErrors();
  const patch: Partial<StoreRecord> = {};

  if ("slug" in body) errors.add("slug", "El link de la tienda no se puede cambiar.");
  if ("name" in body) {
    const name = text(body.name);
    if (name.length < 2 || name.length > LIMITS.name) errors.add("name", "Escribe el nombre de tu negocio (de 2 a 60 letras).");
    else patch.name = name;
  }
  if ("description" in body) {
    const description = text(body.description);
    if (description.length > LIMITS.description) errors.add("description", "Máximo 300 letras.");
    else patch.description = description;
  }
  for (const key of ["logoUrl", "coverUrl"] as const) {
    if (!(key in body)) continue;
    if (body[key] !== null && !text(body[key])) errors.add(key, "La imagen no es válida.");
    else patch[key] = body[key] === null ? null : text(body[key]);
  }
  if ("city" in body) {
    const city = text(body.city);
    if (!city || city.length > LIMITS.city) errors.add("city", "Escribe tu ciudad o distrito.");
    else patch.city = city;
  }
  if ("whatsapp" in body) {
    const whatsapp = toWhatsAppNumber(text(body.whatsapp));
    if (!whatsapp) errors.add("whatsapp", "Escribe un celular de 9 dígitos que empiece con 9.");
    else patch.whatsapp = whatsapp;
  }
  if ("businessHours" in body) {
    const hours = validateBusinessHours(body.businessHours, errors);
    if (hours) patch.businessHours = hours;
  }
  if ("paymentMethods" in body) {
    const methods: unknown[] = Array.isArray(body.paymentMethods) ? body.paymentMethods : [];
    const valid = PAYMENT_METHODS.filter((m) => methods.includes(m));
    if (valid.length === 0 || valid.length !== methods.length) errors.add("paymentMethods", "Elige al menos un método de pago.");
    else patch.paymentMethods = valid;
  }
  if ("paymentInstructions" in body) {
    const instructions = text(body.paymentInstructions);
    if (instructions.length > LIMITS.instructions) errors.add("paymentInstructions", "Máximo 300 letras.");
    else patch.paymentInstructions = instructions || null;
  }
  if ("pickupAddress" in body) {
    const address = text(body.pickupAddress);
    if (address.length > LIMITS.address) errors.add("pickupAddress", "La dirección es muy larga.");
    else patch.pickupAddress = address || null;
  }
  if ("shippingFeeCents" in body) {
    if (body.shippingFeeCents !== null && !isInt(body.shippingFeeCents, 0, MAX_PRICE_CENTS)) {
      errors.add("shippingFeeCents", "Escribe un precio válido o déjalo a coordinar.");
    } else patch.shippingFeeCents = body.shippingFeeCents as number | null;
  }
  if ("reservationHours" in body) {
    if (!isInt(body.reservationHours, 1, 168)) errors.add("reservationHours", "Escribe de 1 a 168 horas.");
    else patch.reservationHours = body.reservationHours;
  }
  if ("features" in body) patch.features = validateFeatures(body.features, store.features, errors);

  errors.throwIfAny("Revisa los datos de tu tienda.");
  Object.assign(store, patch);
  return store;
}

export function toZone(zone: ZoneRecord): DeliveryZone {
  return { id: zone.id, name: zone.name, priceCents: zone.priceCents, active: zone.active };
}

/** GET /me/zones — todas, también las desactivadas. */
export function listZones(db: MockDb, store: StoreRecord): DeliveryZone[] {
  return db.zones.filter((z) => z.storeId === store.id).map(toZone);
}

/** PUT /me/zones — reemplaza la lista completa. */
export function saveZones(db: MockDb, store: StoreRecord, input: unknown): DeliveryZone[] {
  if (!Array.isArray(input)) throw badRequest("La lista de zonas no es válida.");
  const errors = new FieldErrors();
  const current = db.zones.filter((z) => z.storeId === store.id);
  const names = new Set<string>();

  const next: ZoneRecord[] = input.map((raw: unknown, index) => {
    const zone = isObject(raw) ? raw : {};
    const name = text(zone.name);
    if (!name || name.length > LIMITS.city) errors.add(`${index}.name`, "Escribe el nombre del distrito o zona.");
    else if (names.has(name.toLowerCase())) errors.add(`${index}.name`, "Esta zona está repetida.");
    names.add(name.toLowerCase());
    if (!isInt(zone.priceCents, 0, MAX_PRICE_CENTS)) errors.add(`${index}.priceCents`, "Escribe un precio válido.");
    if (typeof zone.active !== "boolean") errors.add(`${index}.active`, "Indica si la zona está activa.");
    const existing = typeof zone.id === "string" ? current.find((z) => z.id === zone.id) : undefined;
    if (zone.id !== undefined && !existing) errors.add(`${index}.id`, "Esta zona no existe.");
    return {
      id: existing?.id ?? `zn_${crypto.randomUUID()}`,
      storeId: store.id,
      name,
      priceCents: zone.priceCents as number,
      active: zone.active as boolean,
    };
  });
  errors.throwIfAny("Revisa las zonas de delivery.");

  db.zones = [...db.zones.filter((z) => z.storeId !== store.id), ...next];
  return next.map(toZone);
}
