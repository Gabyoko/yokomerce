import { beforeEach, describe, expect, it } from "vitest";

import { resetDb } from "../db";
import type { MockDb, StoreRecord } from "../types";
import { getCatalog } from "./catalog";
import { getSessionStore } from "./session";
import { createStore, listZones, saveZones, updateStore } from "./stores";

const NOW = new Date("2026-10-31T15:00:00Z");

let db: MockDb;
let ana: StoreRecord;
beforeEach(() => {
  db = resetDb(NOW);
  ana = db.stores.find((s) => s.slug === "dulcesdeana")!;
});

const registration = {
  ownerName: "Rosa Pérez",
  name: "Velas Rosa",
  slug: "velasrosa",
  whatsapp: "987 111 222",
  city: "Arequipa",
  answers: { deliveryDate: false, madeToOrder: true, shipping: true },
};

describe("getSessionStore", () => {
  const request = (headers: Record<string, string> = {}) => new Request("http://x/api/mock/me/store", { headers });

  it("usa la tienda de la cabecera X-Mock-Store", () => {
    expect(getSessionStore(db, request({ "X-Mock-Store": "fundalab" })).slug).toBe("fundalab");
  });

  it("sin cabecera usa la tienda por defecto", () => {
    expect(getSessionStore(db, request()).slug).toBe("dulcesdeana");
  });

  it("401 si la tienda no existe", () => {
    expect(() => getSessionStore(db, request({ "X-Mock-Store": "no-existe" }))).toThrow(expect.objectContaining({ status: 401 }));
  });
});

describe("createStore", () => {
  it("crea la tienda y activa funciones según las respuestas", () => {
    const store = createStore(db, registration);
    expect(store).toMatchObject({
      slug: "velasrosa",
      name: "Velas Rosa",
      whatsapp: "51987111222",
      plan: "free",
      nextOrderNumber: 1,
      features: { deliveryDate: false, madeToOrder: true, leadTimeDays: 1, shipping: true, pickup: true, deliveryZones: false },
    });
    expect(getCatalog(db, "velasrosa").products).toEqual([]);
  });

  it("sin encargos no sugiere días de anticipación", () => {
    const store = createStore(db, { ...registration, answers: { deliveryDate: true, madeToOrder: false, shipping: false } });
    expect(store.features).toMatchObject({ deliveryDate: true, madeToOrder: false, leadTimeDays: 0, shipping: false, pickup: true });
  });

  it.each([
    ["slug tomado", { slug: "dulcesdeana" }, "slug"],
    ["slug reservado", { slug: "panel" }, "slug"],
    ["slug con formato inválido", { slug: "Mi Tienda" }, "slug"],
    ["celular inválido", { whatsapp: "123" }, "whatsapp"],
    ["sin nombre", { name: "" }, "name"],
    ["sin ciudad", { city: "" }, "city"],
  ])("rechaza %s", (_name, overrides, field) => {
    expect(() => createStore(db, { ...registration, ...overrides })).toThrow(
      expect.objectContaining({ status: 400, extra: { fields: expect.objectContaining({ [field]: expect.any(String) }) } }),
    );
  });
});

describe("updateStore", () => {
  it("cambia solo los campos que vienen", () => {
    updateStore(ana, { name: "Dulces de Ana Torres", description: "Nueva descripción" });
    expect(ana).toMatchObject({ name: "Dulces de Ana Torres", description: "Nueva descripción", city: "Santiago de Surco" });
  });

  it("guarda el WhatsApp con el prefijo 51", () => {
    updateStore(ana, { whatsapp: "955 444 333" });
    expect(ana.whatsapp).toBe("51955444333");
  });

  it("apagar una función la quita del catálogo", () => {
    updateStore(ana, { features: { deliveryZones: false } });
    expect(ana.features.deliveryZones).toBe(false);
    expect(ana.features.pickup).toBe(true);
    expect(getCatalog(db, "dulcesdeana").deliveryZones).toEqual([]);
  });

  it("exige al menos una forma de entrega", () => {
    expect(() => updateStore(ana, { features: { deliveryZones: false, pickup: false } })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(ana.features.pickup).toBe(true);
  });

  it("no cambia nada si algún campo es inválido", () => {
    expect(() => updateStore(ana, { name: "Nuevo nombre", reservationHours: 0 })).toThrow();
    expect(ana.name).toBe("Dulces de Ana");
  });

  it.each([
    [{ slug: "otro" }, "slug"],
    [{ paymentMethods: [] }, "paymentMethods"],
    [{ paymentMethods: ["yape", "bitcoin"] }, "paymentMethods"],
    [{ shippingFeeCents: -1 }, "shippingFeeCents"],
    [{ features: { leadTimeDays: 40 } }, "features.leadTimeDays"],
    [{ businessHours: { mon: { open: "20:00", close: "09:00" } } }, "businessHours.mon"],
    [{ businessHours: { mon: { open: "9", close: "18:00" } } }, "businessHours.mon"],
  ])("rechaza %j", (patch, field) => {
    expect(() => updateStore(ana, patch)).toThrow(
      expect.objectContaining({ extra: { fields: expect.objectContaining({ [field]: expect.any(String) }) } }),
    );
  });

  it("acepta horario con días cerrados y envío a coordinar", () => {
    updateStore(ana, {
      businessHours: { mon: { open: "08:00", close: "18:00" }, sun: null },
      shippingFeeCents: null,
      paymentMethods: ["plin", "yape"],
    });
    expect(ana.businessHours.mon).toEqual({ open: "08:00", close: "18:00" });
    expect(ana.businessHours.tue).toBeNull();
    expect(ana.shippingFeeCents).toBeNull();
    expect(ana.paymentMethods).toEqual(["yape", "plin"]);
  });
});

describe("zonas", () => {
  it("listZones incluye las desactivadas", () => {
    const tn = db.stores.find((s) => s.slug === "tallernorte")!;
    expect(listZones(db, tn).map((z) => [z.name, z.active])).toContainEqual(["Independencia", false]);
  });

  it("saveZones reemplaza la lista: conserva ids, crea nuevas y borra las que faltan", () => {
    const [surco] = listZones(db, ana);
    const saved = saveZones(db, ana, [
      { id: surco!.id, name: "Surco", priceCents: 900, active: true },
      { name: "San Borja", priceCents: 1000, active: false },
    ]);
    expect(saved).toHaveLength(2);
    expect(saved[0]).toEqual({ id: surco!.id, name: "Surco", priceCents: 900, active: true });
    expect(saved[1]!.id).toMatch(/^zn_/);
    expect(listZones(db, ana)).toEqual(saved);
    expect(getCatalog(db, "dulcesdeana").deliveryZones.map((z) => z.name)).toEqual(["Surco"]);
  });

  it("no toca las zonas de otras tiendas", () => {
    const before = db.zones.filter((z) => z.storeId !== ana.id).length;
    saveZones(db, ana, []);
    expect(db.zones.filter((z) => z.storeId !== ana.id)).toHaveLength(before);
  });

  it.each([
    [[{ name: "", priceCents: 800, active: true }], "0.name"],
    [[{ name: "Surco", priceCents: -5, active: true }], "0.priceCents"],
    [[{ name: "Surco", priceCents: 800, active: true }, { name: "surco", priceCents: 800, active: true }], "1.name"],
    [[{ id: "zn_tn_los-olivos", name: "Los Olivos", priceCents: 800, active: true }], "0.id"],
  ])("rechaza zonas inválidas: %j", (zones, field) => {
    expect(() => saveZones(db, ana, zones)).toThrow(
      expect.objectContaining({ extra: { fields: expect.objectContaining({ [field]: expect.any(String) }) } }),
    );
  });
});
