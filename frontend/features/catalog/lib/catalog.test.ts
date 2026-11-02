import { describe, expect, it } from "vitest";

import type { Product, Store, Variant } from "@/shared/types";

import {
  canQuickAdd,
  findVariant,
  initialSelection,
  isValueSelectable,
  maxQuantity,
  orderNotice,
  priceLabel,
  selectValue,
  stockBadge,
} from "./product";
import { getDeliveryLabels, getOpenStatus, storeInitials } from "./store-info";

// --- Horario ---

const weekdays = { open: "09:00", close: "20:00" };
const hours: Store["businessHours"] = {
  mon: weekdays,
  tue: weekdays,
  wed: weekdays,
  thu: weekdays,
  fri: weekdays,
  sat: { open: "10:00", close: "14:00" },
  sun: null,
};
/** Hora de Lima (UTC-5) → instante. */
const lima = (date: string, time: string) => new Date(`${date}T${time}:00-05:00`);

describe("getOpenStatus", () => {
  it("abierto: hasta qué hora", () => {
    expect(getOpenStatus(hours, lima("2026-10-28", "10:00"))).toEqual({ open: true, label: "Abierto hasta 8 p. m." });
  });

  it("antes de abrir: abre hoy", () => {
    expect(getOpenStatus(hours, lima("2026-10-28", "07:30"))).toEqual({ open: false, label: "Cerrado · abre hoy 9 a. m." });
  });

  it("después de cerrar: abre mañana", () => {
    expect(getOpenStatus(hours, lima("2026-10-28", "20:00")).label).toBe("Cerrado · abre mañana 9 a. m.");
  });

  it("sábado en la tarde: el domingo cierra, abre el lunes", () => {
    expect(getOpenStatus(hours, lima("2026-10-31", "15:00")).label).toBe("Cerrado · abre el lunes 9 a. m.");
  });

  it("sábado antes de las 10", () => {
    expect(getOpenStatus(hours, lima("2026-10-31", "09:00")).label).toBe("Cerrado · abre hoy 10 a. m.");
  });

  it("usa la hora de Lima aunque en UTC ya sea otro día", () => {
    // 19:30 del miércoles en Lima = 00:30 UTC del jueves
    expect(getOpenStatus(hours, new Date("2026-10-29T00:30:00Z")).open).toBe(true);
  });

  it("sin horario: cerrado", () => {
    const closed = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
    expect(getOpenStatus(closed, lima("2026-10-28", "10:00"))).toEqual({ open: false, label: "Cerrado" });
  });

  it("horas con minutos", () => {
    const h = { ...hours, wed: { open: "09:30", close: "18:45" } };
    expect(getOpenStatus(h, lima("2026-10-28", "12:00")).label).toBe("Abierto hasta 6:45 p. m.");
  });
});

describe("getDeliveryLabels", () => {
  const features = { deliveryDate: false, leadTimeDays: 0, madeToOrder: false, sizeGuide: false, deliveryZones: true, pickup: true, shipping: true };
  const zones = [
    { id: "a", name: "Surco", priceCents: 1000, active: true },
    { id: "b", name: "Barranco", priceCents: 800, active: true },
  ];

  it("muestra solo lo activo", () => {
    expect(getDeliveryLabels({ store: { features } as Store, deliveryZones: zones })).toEqual([
      "Delivery desde S/ 8",
      "Recojo en tienda",
      "Envíos a todo el Perú",
    ]);
    expect(getDeliveryLabels({ store: { features: { ...features, pickup: false, shipping: false } } as Store, deliveryZones: zones })).toEqual([
      "Delivery desde S/ 8",
    ]);
  });

  it("sin zonas activas no muestra delivery", () => {
    expect(getDeliveryLabels({ store: { features } as Store, deliveryZones: [] })).not.toContain("Delivery desde S/ 8");
  });
});

describe("storeInitials", () => {
  it.each([
    ["Dulces de Ana", "DA"],
    ["Taller Norte", "TN"],
    ["Funda Lab", "FL"],
    ["Yokomerce", "Y"],
  ])("%s → %s", (name, initials) => {
    expect(storeInitials(name)).toBe(initials);
  });
});

// --- Productos ---

const variant = (id: string, values: string[], overrides: Partial<Variant> = {}): Variant => ({
  id,
  optionValueIds: values,
  label: values.join(" / "),
  priceCents: 4500,
  available: 5,
  lowStock: false,
  active: true,
  ...overrides,
});

/** Polo: Color (negro, blanco) × Talla (s, m). Negro/M agotado, Blanco/S desactivado. */
const polo: Product = {
  id: "p1",
  categoryId: null,
  name: "Polo",
  description: "",
  images: [],
  madeToOrder: false,
  sizeGuideUrl: null,
  visible: true,
  position: 0,
  options: [
    { id: "color", name: "Color", values: [{ id: "negro", value: "Negro" }, { id: "blanco", value: "Blanco" }] },
    { id: "talla", name: "Talla", values: [{ id: "s", value: "S" }, { id: "m", value: "M" }] },
  ],
  variants: [
    variant("v1", ["negro", "s"]),
    variant("v2", ["negro", "m"], { available: 0, lowStock: true }),
    variant("v3", ["blanco", "s"], { active: false }),
    variant("v4", ["blanco", "m"], { priceCents: 5000 }),
  ],
  customFields: [],
  priceFromCents: 4500,
};

const simple = (overrides: Partial<Product> = {}, v: Partial<Variant> = {}): Product => ({
  ...polo,
  options: [],
  variants: [variant("d", [], v)],
  ...overrides,
});

describe("priceLabel", () => {
  it("precio único o desde", () => {
    expect(priceLabel(simple())).toBe("S/ 45");
    expect(priceLabel(polo)).toBe("Desde S/ 45");
  });

  it("ignora variantes desactivadas", () => {
    expect(priceLabel({ ...polo, variants: [polo.variants[0]!, { ...polo.variants[3]!, active: false }] })).toBe("S/ 45");
  });
});

describe("stockBadge", () => {
  it("por encargo, agotado, quedan N o nada", () => {
    expect(stockBadge(simple({ madeToOrder: true }, { available: 99 }))).toEqual({ tone: "dark", label: "Por encargo" });
    expect(stockBadge(simple({}, { available: 0 }))).toEqual({ tone: "danger", label: "Agotado" });
    expect(stockBadge(simple({}, { available: 2, lowStock: true }))).toEqual({ tone: "warning", label: "Quedan 2" });
    expect(stockBadge(simple({}, { available: 1, lowStock: true }))).toEqual({ tone: "warning", label: "Queda 1" });
    expect(stockBadge(simple())).toBeNull();
    expect(stockBadge(polo)).toBeNull();
  });
});

describe("canQuickAdd y maxQuantity", () => {
  it("solo productos sin opciones ni campos extra y con stock", () => {
    expect(canQuickAdd(simple())).toBe(true);
    expect(canQuickAdd(polo)).toBe(false);
    expect(canQuickAdd(simple({ customFields: [{ id: "f", label: "Nombre", required: false, maxLength: 20 }] }))).toBe(false);
    expect(canQuickAdd(simple({}, { available: 0 }))).toBe(false);
  });

  it("el máximo es lo disponible (99 en encargos)", () => {
    expect(maxQuantity(polo, polo.variants[0]!)).toBe(5);
    expect(maxQuantity(simple({ madeToOrder: true }), variant("d", [], { available: 0 }))).toBe(99);
    expect(maxQuantity(simple(), variant("d", [], { available: 500 }))).toBe(99);
  });
});

describe("selector de opciones", () => {
  it("empieza con la primera variante disponible", () => {
    expect(initialSelection(polo)).toEqual(["negro", "s"]);
    const soldOut = { ...polo, variants: polo.variants.map((v) => ({ ...v, available: 0 })) };
    expect(initialSelection(soldOut)).toEqual([null, null]);
    expect(initialSelection(simple())).toEqual([]);
  });

  it("encuentra la variante de la selección completa", () => {
    expect(findVariant(polo, ["blanco", "m"])?.id).toBe("v4");
    expect(findVariant(polo, ["blanco", null])).toBeUndefined();
    expect(findVariant(simple(), [])?.id).toBe("d");
  });

  it("tacha los valores sin stock según lo ya elegido", () => {
    // Con Negro elegido, M está agotada
    expect(isValueSelectable(polo, 1, "m", ["negro", "s"])).toBe(false);
    expect(isValueSelectable(polo, 1, "s", ["negro", "s"])).toBe(true);
    // Con Blanco elegido, S está desactivada y M disponible
    expect(isValueSelectable(polo, 1, "s", ["blanco", null])).toBe(false);
    expect(isValueSelectable(polo, 1, "m", ["blanco", null])).toBe(true);
    // Sin color elegido, M existe en Blanco
    expect(isValueSelectable(polo, 1, "m", [null, null])).toBe(true);
  });

  it("al cambiar un valor suelta los que ya no combinan", () => {
    // Negro / S → elegir Blanco: S no existe en Blanco, se suelta
    expect(selectValue(polo, ["negro", "s"], 0, "blanco")).toEqual(["blanco", null]);
    // Blanco / M → elegir Negro: M está agotada en Negro, se suelta
    expect(selectValue(polo, ["blanco", "m"], 0, "negro")).toEqual(["negro", null]);
    // Negro / S → elegir Talla S otra vez: no cambia nada
    expect(selectValue(polo, ["negro", "s"], 1, "s")).toEqual(["negro", "s"]);
  });
});

describe("orderNotice", () => {
  const features = { deliveryDate: true, leadTimeDays: 1, madeToOrder: true, sizeGuide: false, deliveryZones: true, pickup: true, shipping: false };

  it("avisa la anticipación si la tienda usa fecha de entrega o el producto es por encargo", () => {
    expect(orderNotice(simple(), features)).toBe("Pídelo con 1 día de anticipación.");
    expect(orderNotice(simple(), { ...features, leadTimeDays: 3 })).toBe("Pídelo con 3 días de anticipación.");
    expect(orderNotice(simple({ madeToOrder: true }), { ...features, deliveryDate: false })).toBe("Pídelo con 1 día de anticipación.");
  });

  it("encargo sin anticipación y productos normales", () => {
    expect(orderNotice(simple({ madeToOrder: true }), { ...features, leadTimeDays: 0 })).toBe("Se prepara por encargo.");
    expect(orderNotice(simple(), { ...features, deliveryDate: false })).toBeNull();
    expect(orderNotice(simple(), { ...features, leadTimeDays: 0 })).toBeNull();
  });
});
