import { centsToInput, parseSolesInput } from "@/shared/lib/money";
import { formatPeruPhone, normalizePeruPhone } from "@/shared/lib/phone";
import type { DeliveryZone, PaymentMethod, Store, StoreFeatures, UpdateStoreInput, Weekday, ZoneInput } from "@/shared/types";

/*
 * Formulario de Configuración. El borrador guarda lo que escribe el dueño (precios como texto);
 * al guardar se valida y se arma solo lo que cambió: PATCH /me/store y PUT /me/zones.
 */

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};
export const PAYMENT_METHODS: PaymentMethod[] = ["yape", "plin", "cash", "transfer"];

export const SETTINGS_LIMITS = {
  name: 60,
  description: 300,
  city: 60,
  instructions: 300,
  address: 200,
  zoneName: 60,
  leadTimeDays: 30,
  reservationHours: 168,
} as const;

/** Zona en edición. `key` identifica la fila en la lista (las nuevas aún no tienen id). */
export type ZoneDraft = { key: string; id?: string; name: string; price: string; active: boolean };

export type SettingsDraft = {
  name: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  city: string;
  whatsapp: string;
  businessHours: Store["businessHours"];
  paymentMethods: PaymentMethod[];
  paymentInstructions: string;
  pickupAddress: string;
  /** Envío a provincia: precio fijo o "a coordinar" (shippingFeeCents = null). */
  shippingMode: "fixed" | "coordinate";
  shippingFee: string;
  reservationHours: string;
  features: Omit<StoreFeatures, "leadTimeDays"> & { leadTimeDays: string };
  zones: ZoneDraft[];
};

export type SettingsErrors = Record<string, string>;

export function toDraft(store: Store, zones: DeliveryZone[]): SettingsDraft {
  return {
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    coverUrl: store.coverUrl,
    city: store.city,
    whatsapp: formatPeruPhone(store.whatsapp),
    businessHours: store.businessHours,
    paymentMethods: store.paymentMethods,
    paymentInstructions: store.paymentInstructions ?? "",
    pickupAddress: store.pickupAddress ?? "",
    shippingMode: store.shippingFeeCents === null ? "coordinate" : "fixed",
    shippingFee: store.shippingFeeCents === null ? "" : centsToInput(store.shippingFeeCents),
    reservationHours: String(store.reservationHours),
    features: { ...store.features, leadTimeDays: String(store.features.leadTimeDays) },
    zones: zones.map((zone) => ({
      key: zone.id,
      id: zone.id,
      name: zone.name,
      price: centsToInput(zone.priceCents),
      active: zone.active,
    })),
  };
}

const wholeNumber = (value: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

/**
 * Revisa el borrador con las reglas de la API y algunas más de sentido común
 * (delivery con al menos una zona activa, recojo con dirección). Las claves son las de la API.
 */
export function validateSettings(draft: SettingsDraft): SettingsErrors {
  const errors: SettingsErrors = {};
  const L = SETTINGS_LIMITS;
  const name = draft.name.trim();
  if (name.length < 2 || name.length > L.name) errors.name = "Escribe el nombre de tu negocio (de 2 a 60 letras).";
  if (draft.description.trim().length > L.description) errors.description = `Máximo ${L.description} letras.`;
  const city = draft.city.trim();
  if (!city || city.length > L.city) errors.city = "Escribe tu ciudad o distrito.";
  if (!normalizePeruPhone(draft.whatsapp)) errors.whatsapp = "Escribe un celular de 9 dígitos que empiece con 9.";

  for (const day of WEEKDAYS) {
    const hours = draft.businessHours[day];
    if (hours && !(hours.open && hours.close && hours.open < hours.close)) {
      errors[`businessHours.${day}`] = "La hora de cierre debe ser después de la de apertura.";
    }
  }
  if (WEEKDAYS.every((day) => draft.businessHours[day] === null)) {
    errors.businessHours = "Abre al menos un día a la semana.";
  }

  if (draft.paymentMethods.length === 0) errors.paymentMethods = "Elige al menos un método de pago.";
  if (draft.paymentInstructions.trim().length > L.instructions) errors.paymentInstructions = `Máximo ${L.instructions} letras.`;
  if (wholeNumber(draft.reservationHours, 1, L.reservationHours) === null) {
    errors.reservationHours = `Escribe de 1 a ${L.reservationHours} horas.`;
  }

  const { features } = draft;
  if (!features.deliveryZones && !features.pickup && !features.shipping) {
    errors.features = "Activa al menos una forma de entrega: delivery, recojo o envío.";
  }
  if (features.deliveryDate && wholeNumber(features.leadTimeDays, 0, L.leadTimeDays) === null) {
    errors["features.leadTimeDays"] = `Escribe de 0 a ${L.leadTimeDays} días.`;
  }
  if (features.pickup) {
    const address = draft.pickupAddress.trim();
    if (!address) errors.pickupAddress = "Escribe la dirección donde recogen los pedidos.";
    else if (address.length > L.address) errors.pickupAddress = "La dirección es muy larga.";
  }
  if (features.shipping && draft.shippingMode === "fixed" && parseSolesInput(draft.shippingFee) === null) {
    errors.shippingFeeCents = "Escribe el precio del envío o elige «a coordinar».";
  }

  const names = new Set<string>();
  draft.zones.forEach((zone, index) => {
    const zoneName = zone.name.trim();
    if (!zoneName || zoneName.length > L.zoneName) errors[`zones.${index}.name`] = "Escribe el distrito o zona.";
    else if (names.has(zoneName.toLowerCase())) errors[`zones.${index}.name`] = "Esta zona está repetida.";
    names.add(zoneName.toLowerCase());
    if (parseSolesInput(zone.price) === null) errors[`zones.${index}.priceCents`] = "Escribe el precio.";
  });
  if (features.deliveryZones && !draft.zones.some((z) => z.active)) {
    errors.zones = "Agrega al menos una zona activa para hacer delivery.";
  }
  return errors;
}

/** Lista de zonas para PUT /me/zones. Llamar solo con un borrador válido. */
export function zonesInput(draft: SettingsDraft): ZoneInput[] {
  return draft.zones.map((zone) => ({
    ...(zone.id ? { id: zone.id } : {}),
    name: zone.name.trim(),
    priceCents: parseSolesInput(zone.price) ?? 0,
    active: zone.active,
  }));
}

export function zonesChanged(zones: DeliveryZone[], draft: SettingsDraft): boolean {
  const next = zonesInput(draft);
  return (
    next.length !== zones.length ||
    next.some((zone, i) => {
      const current = zones[i];
      return (
        !current ||
        zone.id !== current.id ||
        zone.name !== current.name ||
        zone.priceCents !== current.priceCents ||
        zone.active !== current.active
      );
    })
  );
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Solo los campos que cambiaron, para PATCH /me/store. Llamar solo con un borrador válido. */
export function settingsPatch(store: Store, draft: SettingsDraft): UpdateStoreInput {
  const patch: UpdateStoreInput = {};
  const textFields = [
    ["name", draft.name.trim()],
    ["description", draft.description.trim()],
    ["city", draft.city.trim()],
  ] as const;
  for (const [key, value] of textFields) if (value !== store[key]) patch[key] = value;

  if (draft.logoUrl !== store.logoUrl) patch.logoUrl = draft.logoUrl;
  if (draft.coverUrl !== store.coverUrl) patch.coverUrl = draft.coverUrl;

  const whatsapp = normalizePeruPhone(draft.whatsapp);
  if (whatsapp && `51${whatsapp}` !== store.whatsapp) patch.whatsapp = whatsapp;

  if (!sameJson(draft.businessHours, store.businessHours)) patch.businessHours = draft.businessHours;
  const methods = PAYMENT_METHODS.filter((m) => draft.paymentMethods.includes(m));
  if (!sameJson(methods, store.paymentMethods)) patch.paymentMethods = methods;

  const instructions = draft.paymentInstructions.trim() || null;
  if (instructions !== store.paymentInstructions) patch.paymentInstructions = instructions;
  // La dirección de recojo y el precio de envío se conservan aunque la función se apague
  const pickupAddress = draft.pickupAddress.trim() || null;
  if (pickupAddress !== store.pickupAddress) patch.pickupAddress = pickupAddress;
  if (draft.features.shipping) {
    const fee = draft.shippingMode === "coordinate" ? null : parseSolesInput(draft.shippingFee);
    if (fee !== store.shippingFeeCents) patch.shippingFeeCents = fee;
  }
  const reservationHours = Number(draft.reservationHours);
  if (reservationHours !== store.reservationHours) patch.reservationHours = reservationHours;

  const features: Partial<StoreFeatures> = {};
  for (const key of ["deliveryDate", "madeToOrder", "sizeGuide", "deliveryZones", "pickup", "shipping"] as const) {
    if (draft.features[key] !== store.features[key]) features[key] = draft.features[key];
  }
  if (draft.features.deliveryDate) {
    const lead = Number(draft.features.leadTimeDays);
    if (lead !== store.features.leadTimeDays) features.leadTimeDays = lead;
  }
  if (Object.keys(features).length > 0) patch.features = features;

  return patch;
}
