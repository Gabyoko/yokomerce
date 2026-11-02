import { describe, expect, it } from "vitest";

import type { DeliveryZone, Store } from "@/shared/types";

import { type SettingsDraft, settingsPatch, toDraft, validateSettings, zonesChanged, zonesInput } from "./settings";

const open = { open: "09:00", close: "20:00" };
const store: Store = {
  id: "st_1",
  slug: "dulcesdeana",
  name: "Dulces de Ana",
  description: "Tortas",
  logoUrl: null,
  coverUrl: null,
  city: "Santiago de Surco",
  whatsapp: "51912345678",
  businessHours: { mon: open, tue: open, wed: open, thu: open, fri: open, sat: open, sun: null },
  paymentMethods: ["yape", "plin"],
  paymentInstructions: null,
  features: {
    deliveryDate: true,
    leadTimeDays: 1,
    madeToOrder: true,
    sizeGuide: false,
    deliveryZones: true,
    pickup: true,
    shipping: false,
  },
  pickupAddress: "Jr. Las Gardenias 245",
  shippingFeeCents: null,
  reservationHours: 24,
  plan: "free",
  planExpiresAt: null,
};
const zones: DeliveryZone[] = [
  { id: "z1", name: "Santiago de Surco", priceCents: 800, active: true },
  { id: "z2", name: "Miraflores", priceCents: 1050, active: false },
];

const draft = (change: (d: SettingsDraft) => void = () => {}) => {
  const d = structuredClone(toDraft(store, zones));
  change(d);
  return d;
};

describe("toDraft", () => {
  it("convierte precios y celular a texto editable", () => {
    const d = draft();
    expect(d.whatsapp).toBe("912 345 678");
    expect(d.zones.map((z) => z.price)).toEqual(["8", "10.50"]);
    expect(d.shippingMode).toBe("coordinate");
    expect(d.features.leadTimeDays).toBe("1");
  });
});

describe("validateSettings", () => {
  it("el borrador de una tienda válida no tiene errores", () => {
    expect(validateSettings(draft())).toEqual({});
  });

  it("pide al menos una forma de entrega", () => {
    const errors = validateSettings(
      draft((d) => Object.assign(d.features, { deliveryZones: false, pickup: false, shipping: false })),
    );
    expect(errors.features).toMatch(/al menos una forma de entrega/);
  });

  it("delivery necesita una zona activa y recojo una dirección", () => {
    const errors = validateSettings(
      draft((d) => {
        d.zones = d.zones.map((z) => ({ ...z, active: false }));
        d.pickupAddress = " ";
      }),
    );
    expect(errors.zones).toBeDefined();
    expect(errors.pickupAddress).toBeDefined();
  });

  it("valida zonas repetidas, precios, horarios, celular y días de anticipación", () => {
    const errors = validateSettings(
      draft((d) => {
        d.zones[1]!.name = "santiago de surco";
        d.zones[0]!.price = "abc";
        d.businessHours = { ...d.businessHours, mon: { open: "20:00", close: "09:00" } };
        d.whatsapp = "12345";
        d.features.leadTimeDays = "31";
      }),
    );
    expect(Object.keys(errors).sort()).toEqual(
      ["businessHours.mon", "features.leadTimeDays", "whatsapp", "zones.0.priceCents", "zones.1.name"].sort(),
    );
  });

  it("envío con precio fijo necesita el precio", () => {
    const errors = validateSettings(
      draft((d) => {
        d.features.shipping = true;
        d.shippingMode = "fixed";
      }),
    );
    expect(errors.shippingFeeCents).toBeDefined();
  });

  it("pide al menos un día abierto y un método de pago", () => {
    const errors = validateSettings(
      draft((d) => {
        d.businessHours = Object.fromEntries(Object.keys(d.businessHours).map((k) => [k, null])) as Store["businessHours"];
        d.paymentMethods = [];
      }),
    );
    expect(errors.businessHours).toBeDefined();
    expect(errors.paymentMethods).toBeDefined();
  });
});

describe("settingsPatch", () => {
  it("sin cambios no manda nada", () => {
    expect(settingsPatch(store, draft())).toEqual({});
  });

  it("manda solo lo que cambió", () => {
    const patch = settingsPatch(
      store,
      draft((d) => {
        d.name = " Dulces de Ana Torres ";
        d.whatsapp = "987 654 321";
        d.paymentMethods = ["plin", "yape", "cash"];
        d.features.pickup = false;
        d.features.leadTimeDays = "2";
        d.paymentInstructions = "Yape al 912 345 678";
      }),
    );
    expect(patch).toEqual({
      name: "Dulces de Ana Torres",
      whatsapp: "987654321",
      paymentMethods: ["yape", "plin", "cash"],
      paymentInstructions: "Yape al 912 345 678",
      features: { pickup: false, leadTimeDays: 2 },
    });
  });

  it("envío: precio fijo en céntimos o null si es a coordinar", () => {
    const fixed = settingsPatch(
      store,
      draft((d) => {
        d.features.shipping = true;
        d.shippingMode = "fixed";
        d.shippingFee = "15";
      }),
    );
    expect(fixed).toEqual({ shippingFeeCents: 1500, features: { shipping: true } });
  });
});

describe("zonas", () => {
  it("detecta cambios y arma la lista completa (las nuevas sin id)", () => {
    expect(zonesChanged(zones, draft())).toBe(false);
    const d = draft((x) => x.zones.push({ key: "nueva", name: " Barranco ", price: "10", active: true }));
    expect(zonesChanged(zones, d)).toBe(true);
    expect(zonesInput(d)[2]).toEqual({ name: "Barranco", priceCents: 1000, active: true });
    expect(zonesInput(d)[0]).toEqual({ id: "z1", name: "Santiago de Surco", priceCents: 800, active: true });
  });
});
