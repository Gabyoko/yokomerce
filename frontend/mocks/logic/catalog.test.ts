import { beforeEach, describe, expect, it } from "vitest";

import { resetDb } from "../db";
import type { MockDb } from "../types";
import { getCatalog, getPublicProduct, MADE_TO_ORDER_AVAILABLE } from "./catalog";
import { MockApiError } from "./errors";
import { checkSlug } from "./stores";

const NOW = new Date("2026-10-31T15:00:00Z");

let db: MockDb;
beforeEach(() => {
  db = resetDb(NOW);
});

const store = (slug: string) => db.stores.find((s) => s.slug === slug)!;

describe("getCatalog", () => {
  it("devuelve la tienda sin columnas internas", () => {
    const { store: s } = getCatalog(db, "dulcesdeana");
    expect(s.name).toBe("Dulces de Ana");
    expect(s).not.toHaveProperty("ownerName");
    expect(s).not.toHaveProperty("nextOrderNumber");
  });

  it("solo incluye productos visibles, en orden", () => {
    const { products } = getCatalog(db, "tallernorte");
    expect(products.map((p) => p.name)).not.toContain("Short cargo");
    expect(products.map((p) => p.position)).toEqual([...products.map((p) => p.position)].sort((a, b) => a - b));
  });

  it("solo incluye zonas activas", () => {
    const { deliveryZones } = getCatalog(db, "tallernorte");
    expect(deliveryZones.map((z) => z.name)).toEqual(["Los Olivos", "San Martín de Porres", "Comas"]);
    expect(deliveryZones[0]).not.toHaveProperty("storeId");
  });

  it("sin zonas si la tienda apagó el delivery por zonas", () => {
    store("dulcesdeana").features.deliveryZones = false;
    expect(getCatalog(db, "dulcesdeana").deliveryZones).toEqual([]);
  });

  it("calcula available, lowStock y no expone onHand ni reserved", () => {
    const torta = getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Torta de chocolate")!;
    const grande = torta.variants.find((v) => v.label === "Grande")!;
    expect(grande).toMatchObject({ available: 1, lowStock: true, priceCents: 7000 });
    expect(grande).not.toHaveProperty("onHand");
    expect(grande).not.toHaveProperty("reserved");
    expect(grande).not.toHaveProperty("lowStockThreshold");

    const keke = getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Keke de naranja")!;
    expect(keke.variants[0]!.available).toBe(0);

    const alfajores = getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Alfajores x12")!;
    expect(alfajores.variants[0]).toMatchObject({ lowStock: false });
  });

  it("priceFromCents es el precio más bajo entre variantes activas", () => {
    const torta = getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Torta de chocolate")!;
    expect(torta.priceFromCents).toBe(4500);
    db.variants.find((v) => v.id === "va_da_torta-chocolate_mediana")!.active = false;
    expect(getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Torta de chocolate")!.priceFromCents).toBe(7000);
  });

  it("por encargo: nunca agotado ni con stock bajo", () => {
    const tresLeches = getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Torta tres leches")!;
    expect(tresLeches.madeToOrder).toBe(true);
    expect(tresLeches.variants[0]).toMatchObject({ available: MADE_TO_ORDER_AVAILABLE, lowStock: false });
  });

  it("las funciones apagadas no aparecen: encargo y guía de tallas", () => {
    store("dulcesdeana").features.madeToOrder = false;
    const tresLeches = getCatalog(db, "dulcesdeana").products.find((p) => p.name === "Torta tres leches")!;
    expect(tresLeches.madeToOrder).toBe(false);
    expect(tresLeches.variants[0]!.available).toBe(0);

    store("tallernorte").features.sizeGuide = false;
    const polo = getCatalog(db, "tallernorte").products.find((p) => p.name === "Polo oversize")!;
    expect(polo.sizeGuideUrl).toBeNull();
  });

  it("404 si la tienda no existe", () => {
    expect(() => getCatalog(db, "no-existe")).toThrow(expect.objectContaining({ status: 404, code: "not_found" }));
  });
});

describe("getPublicProduct", () => {
  it("devuelve un producto visible de la tienda", () => {
    expect(getPublicProduct(db, "fundalab", "pr_fl_cargador-rapido").name).toBe("Cargador rápido 20 W");
  });

  it("404 para productos ocultos o de otra tienda", () => {
    expect(() => getPublicProduct(db, "tallernorte", "pr_tn_short-cargo")).toThrow(MockApiError);
    expect(() => getPublicProduct(db, "tallernorte", "pr_fl_cargador-rapido")).toThrow(MockApiError);
  });
});

describe("checkSlug", () => {
  it.each([
    ["mitienda", true],
    ["mi-tienda-2", true],
    ["dulcesdeana", false],
    ["panel", false],
    ["dev", false],
    ["ab", false],
    ["-tienda", false],
    ["tienda-", false],
    ["mi--tienda", false],
    ["mi_tienda", false],
    ["Mi Tienda", false],
    ["a".repeat(31), false],
  ])("%s → disponible: %s", (slug, available) => {
    expect(checkSlug(db, slug)).toEqual({ available });
  });

  it("no distingue mayúsculas al comparar con tiendas existentes", () => {
    expect(checkSlug(db, "DulcesDeAna")).toEqual({ available: false });
  });
});
