import { describe, expect, it } from "vitest";

import type { DeliveryZone, Store } from "@/shared/types";

import { dateChipLabel, deliveryDateOptions } from "./delivery-dates";
import { buildOrderInput, type CheckoutContext, type CheckoutForm, splitServerErrors, validateCheckout } from "./form";
import { feeLine, fulfillmentOptions, initialFulfillment } from "./fulfillment";

const open = { open: "09:00", close: "20:00" };
const hours: Store["businessHours"] = { mon: open, tue: open, wed: open, thu: open, fri: open, sat: open, sun: null };
const features: Store["features"] = {
  deliveryDate: true,
  leadTimeDays: 1,
  madeToOrder: true,
  sizeGuide: false,
  deliveryZones: true,
  pickup: true,
  shipping: false,
};
const zones: DeliveryZone[] = [
  { id: "z1", name: "Santiago de Surco", priceCents: 800, active: true },
  { id: "z2", name: "Miraflores", priceCents: 1000, active: true },
];
const store = { features, businessHours: hours, shippingFeeCents: null, pickupAddress: "Jr. Las Gardenias 245" };

// Viernes 30 de octubre de 2026, 10 a. m. en Lima
const FRIDAY = new Date("2026-10-30T15:00:00Z");

describe("deliveryDateOptions", () => {
  it("empieza en hoy + anticipación y salta los días sin atención", () => {
    const dates = deliveryDateOptions(store, FRIDAY);
    expect(dates.slice(0, 3)).toEqual(["2026-10-31", "2026-11-02", "2026-11-03"]);
    expect(dates).toHaveLength(7);
    expect(dates).not.toContain("2026-11-01");
  });

  it("usa la fecha de Lima, no la UTC", () => {
    // 11 p. m. del viernes en Lima ya es sábado en UTC
    expect(deliveryDateOptions(store, new Date("2026-10-31T04:00:00Z"))[0]).toBe("2026-10-31");
  });

  it("sin anticipación incluye hoy", () => {
    expect(deliveryDateOptions({ ...store, features: { ...features, leadTimeDays: 0 } }, FRIDAY)[0]).toBe("2026-10-30");
  });

  it("no da opciones si la tienda no usa fecha de entrega", () => {
    expect(deliveryDateOptions({ ...store, features: { ...features, deliveryDate: false } }, FRIDAY)).toEqual([]);
  });

  it("no da opciones si la tienda no atiende ningún día", () => {
    const closed = Object.fromEntries(Object.keys(hours).map((d) => [d, null])) as Store["businessHours"];
    expect(deliveryDateOptions({ ...store, businessHours: closed }, FRIDAY)).toEqual([]);
  });
});

describe("dateChipLabel", () => {
  it("dice Hoy, Mañana o el día de la semana", () => {
    expect(dateChipLabel("2026-10-30", "2026-10-30")).toEqual({ top: "Hoy", bottom: "30 oct" });
    expect(dateChipLabel("2026-10-31", "2026-10-30")).toEqual({ top: "Mañana", bottom: "31 oct" });
    expect(dateChipLabel("2026-11-02", "2026-10-30")).toEqual({ top: "Lun", bottom: "2 nov" });
  });
});

describe("fulfillmentOptions", () => {
  it("muestra solo las formas activas", () => {
    expect(fulfillmentOptions({ store, zones })).toEqual([
      { type: "delivery", title: "Delivery", detail: "Desde S/ 8" },
      { type: "pickup", title: "Recojo en tienda", detail: "Gratis" },
    ]);
  });

  it("sin zonas activas no hay delivery; el envío sin precio es a coordinar", () => {
    const shipping = { ...store, features: { ...features, pickup: false, shipping: true } };
    expect(fulfillmentOptions({ store: shipping, zones: [] })).toEqual([
      { type: "shipping", title: "Envío a provincia", detail: "Costo a coordinar" },
    ]);
  });

  it("elige la forma inicial", () => {
    const options = fulfillmentOptions({ store, zones });
    expect(initialFulfillment(options, "pickup")).toBe("pickup");
    expect(initialFulfillment(options, "shipping")).toBeNull();
    expect(initialFulfillment(options.slice(0, 1), null)).toBe("delivery");
  });
});

describe("feeLine", () => {
  const ctx = { store, zones };
  it("delivery sin distrito todavía", () => {
    expect(feeLine(ctx, "delivery", "")).toEqual({ label: "Delivery", amount: undefined, hint: "Según tu distrito" });
  });
  it("delivery con distrito, recojo y envío a coordinar", () => {
    expect(feeLine(ctx, "delivery", "z1")).toEqual({ label: "Delivery a Santiago de Surco", amount: 800 });
    expect(feeLine(ctx, "pickup", "")).toEqual({ label: "Recojo en tienda", amount: 0 });
    expect(feeLine(ctx, "shipping", "")).toEqual({ label: "Envío", amount: null });
  });
});

const ctx: CheckoutContext = {
  store,
  zones,
  paymentMethods: ["yape", "cash"],
  dates: ["2026-10-31", "2026-11-02"],
};

const filled: CheckoutForm = {
  name: " María López ",
  phone: "987 654 321",
  fulfillmentType: "delivery",
  zoneId: "z1",
  city: "",
  address: "Av. Primavera 123",
  reference: "",
  deliveryDate: "2026-10-31",
  paymentMethod: "yape",
};

describe("validateCheckout", () => {
  it("acepta un formulario completo", () => {
    expect(validateCheckout(filled, ctx)).toEqual({});
  });

  it("pide todo lo que falta", () => {
    const empty: CheckoutForm = { ...filled, name: "", phone: "", fulfillmentType: null, deliveryDate: null, paymentMethod: null };
    expect(Object.keys(validateCheckout(empty, ctx)).sort()).toEqual(
      ["customer.name", "customer.phone", "deliveryDate", "fulfillment.type", "paymentMethod"].sort(),
    );
  });

  it("valida el celular peruano", () => {
    expect(validateCheckout({ ...filled, phone: "812345678" }, ctx)["customer.phone"]).toBe(
      "Debe tener 9 dígitos y empezar con 9.",
    );
  });

  it("delivery necesita distrito y dirección; recojo no", () => {
    expect(Object.keys(validateCheckout({ ...filled, zoneId: "", address: " " }, ctx))).toEqual([
      "fulfillment.zoneId",
      "fulfillment.address",
    ]);
    expect(validateCheckout({ ...filled, fulfillmentType: "pickup", zoneId: "", address: "" }, ctx)).toEqual({});
  });

  it("envío necesita ciudad y dirección", () => {
    expect(Object.keys(validateCheckout({ ...filled, fulfillmentType: "shipping", address: "" }, ctx))).toEqual([
      "fulfillment.city",
      "fulfillment.address",
    ]);
  });

  it("la fecha solo se pide si la tienda la usa, y debe ser una de las opciones", () => {
    expect(validateCheckout({ ...filled, deliveryDate: null }, { ...ctx, dates: [] })).toEqual({});
    expect(validateCheckout({ ...filled, deliveryDate: "2026-11-01" }, ctx).deliveryDate).toBeDefined();
  });

  it("el pago debe ser uno que acepte la tienda", () => {
    expect(validateCheckout({ ...filled, paymentMethod: "plin" }, ctx).paymentMethod).toBeDefined();
  });
});

describe("buildOrderInput", () => {
  const items = [{ variantId: "v1", quantity: 2, customValues: { Dedicatoria: "Feliz día" } }];

  it("arma el pedido de delivery con el celular normalizado", () => {
    expect(buildOrderInput("dulcesdeana", items, { ...filled, reference: " Frente al parque " })).toEqual({
      storeSlug: "dulcesdeana",
      items,
      customer: { name: "María López", phone: "987654321" },
      fulfillment: { type: "delivery", zoneId: "z1", address: "Av. Primavera 123", reference: "Frente al parque" },
      deliveryDate: "2026-10-31",
      paymentMethod: "yape",
    });
  });

  it("en recojo no manda dirección; sin fecha no manda deliveryDate", () => {
    const input = buildOrderInput("x", items, { ...filled, fulfillmentType: "pickup", deliveryDate: null });
    expect(input.fulfillment).toEqual({ type: "pickup" });
    expect("deliveryDate" in input).toBe(false);
  });

  it("en envío manda ciudad y no zona", () => {
    const input = buildOrderInput("x", items, { ...filled, fulfillmentType: "shipping", city: " Arequipa " });
    expect(input.fulfillment).toEqual({ type: "shipping", city: "Arequipa", address: "Av. Primavera 123" });
  });
});

describe("splitServerErrors", () => {
  it("separa los errores del formulario de los del carrito", () => {
    expect(
      splitServerErrors({
        "customer.phone": "Celular inválido.",
        "items.0.variantId": "Este producto ya no está disponible.",
        "items.1.variantId": "Este producto ya no está disponible.",
      }),
    ).toEqual({ form: { "customer.phone": "Celular inválido." }, other: ["Este producto ya no está disponible."] });
  });
});
