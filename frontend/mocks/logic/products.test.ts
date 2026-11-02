import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductInput } from "@/shared/types";

import { resetDb } from "../db";
import type { MockDb, StoreRecord } from "../types";
import { getCatalog } from "./catalog";
import { createOrder } from "./orders";
import {
  createProduct,
  getProductAdmin,
  listCategories,
  listProducts,
  saveCategories,
  setProductVisible,
  updateProduct,
} from "./products";

const NOW = new Date("2026-10-31T15:00:00Z");

let db: MockDb;
let tn: StoreRecord;
let ana: StoreRecord;
beforeEach(() => {
  db = resetDb(NOW);
  tn = db.stores.find((s) => s.slug === "tallernorte")!;
  ana = db.stores.find((s) => s.slug === "dulcesdeana")!;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Polera con 3 tallas × 2 colores: la condición de "listo" de F6. */
function polera(overrides: Partial<ProductInput> = {}): ProductInput {
  const sizes = ["S", "M", "L"];
  const colors = ["Negro", "Blanco"];
  return {
    categoryId: null,
    name: "Polera básica",
    description: "Algodón",
    images: [],
    madeToOrder: false,
    sizeGuideUrl: null,
    visible: true,
    options: [
      { name: "Talla", values: sizes.map((value) => ({ value })) },
      { name: "Color", values: colors.map((value) => ({ value })) },
    ],
    variants: sizes.flatMap((size, i) =>
      colors.map((color, j) => ({
        optionValues: [size, color],
        priceCents: 5900,
        active: true,
        lowStockThreshold: 2,
        initialStock: i * 2 + j + 1,
      })),
    ),
    customFields: [],
    ...overrides,
  };
}

describe("categorías", () => {
  it("saveCategories conserva ids, ordena y deja sin categoría los productos de las borradas", () => {
    const [polos, casacas] = listCategories(db, tn);
    const saved = saveCategories(db, tn, [{ id: casacas!.id, name: "Casacas" }, { name: "Ofertas" }]);
    expect(saved.map((c) => [c.name, c.position])).toEqual([
      ["Casacas", 0],
      ["Ofertas", 1],
    ]);
    expect(saved[0]!.id).toBe(casacas!.id);
    const polo = listProducts(db, tn).find((p) => p.name === "Polo oversize")!;
    expect(polo.categoryId).toBeNull();
    expect(db.products.some((p) => p.categoryId === polos!.id)).toBe(false);
  });

  it("rechaza nombres repetidos", () => {
    expect(() => saveCategories(db, tn, [{ name: "Polos" }, { name: "polos" }])).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("listProducts y getProductAdmin", () => {
  it("incluye los ocultos y el stock interno", () => {
    const products = listProducts(db, tn);
    expect(products.map((p) => p.name)).toContain("Short cargo");
    expect(products[0]!.variants[0]).toHaveProperty("onHand");
    expect(products[0]!.variants[0]).toHaveProperty("reserved");
  });

  it("404 para productos de otra tienda", () => {
    expect(() => getProductAdmin(db, tn, "pr_da_keke-naranja")).toThrow(expect.objectContaining({ status: 404 }));
  });
});

describe("createProduct", () => {
  it("crea 3 tallas × 2 colores y cada combinación tiene su stock", () => {
    const product = createProduct(db, tn, polera(), NOW);
    expect(product.variants).toHaveLength(6);
    expect(product.variants.map((v) => [v.label, v.onHand])).toEqual([
      ["S / Negro", 1],
      ["S / Blanco", 2],
      ["M / Negro", 3],
      ["M / Blanco", 4],
      ["L / Negro", 5],
      ["L / Blanco", 6],
    ]);
    expect(product.priceFromCents).toBe(5900);
    // El stock inicial queda en el historial
    const movement = db.movements.find((m) => m.variantId === product.variants[5]!.id)!;
    expect(movement).toMatchObject({ type: "in", quantity: 6, reason: "stock_inicial" });
    // Y aparece en el catálogo público
    expect(getCatalog(db, "tallernorte").products.map((p) => p.name)).toContain("Polera básica");
  });

  it("producto sin opciones: una variante por defecto", () => {
    const product = createProduct(
      db,
      tn,
      polera({ options: [], variants: [{ optionValues: [], priceCents: 2500, active: true, lowStockThreshold: null, initialStock: 4 }] }),
      NOW,
    );
    expect(product.variants).toEqual([expect.objectContaining({ label: "", optionValueIds: [], onHand: 4 })]);
  });

  it.each([
    ["falta una combinación", (p: ProductInput) => ({ ...p, variants: p.variants.slice(1) }), "variants"],
    ["combinación repetida", (p: ProductInput) => ({ ...p, variants: [...p.variants.slice(1), p.variants[1]!] }), "variants"],
    ["valor que no existe", (p: ProductInput) => ({ ...p, variants: [{ ...p.variants[0]!, optionValues: ["XXL", "Negro"] }, ...p.variants.slice(1)] }), "variants"],
    ["más de 3 opciones", (p: ProductInput) => ({ ...p, options: [1, 2, 3, 4].map((n) => ({ name: `O${n}`, values: [{ value: "a" }] })) }), "options"],
    ["valores repetidos", (p: ProductInput) => ({ ...p, options: [{ name: "Talla", values: [{ value: "S" }, { value: "s" }] }] }), "options.0.values"],
    ["precio negativo", (p: ProductInput) => ({ ...p, variants: [{ ...p.variants[0]!, priceCents: -1 }, ...p.variants.slice(1)] }), "variants.0.priceCents"],
    ["más de 5 fotos", (p: ProductInput) => ({ ...p, images: ["a", "b", "c", "d", "e", "f"] }), "images"],
    ["categoría de otra tienda", (p: ProductInput) => ({ ...p, categoryId: "ct_da_tortas" }), "categoryId"],
    ["sin nombre", (p: ProductInput) => ({ ...p, name: "" }), "name"],
  ])("rechaza: %s", (_name, change, field) => {
    expect(() => createProduct(db, tn, change(polera()), NOW)).toThrow(
      expect.objectContaining({ status: 400, extra: { fields: expect.objectContaining({ [field]: expect.any(String) }) } }),
    );
  });

  it("rechaza funciones apagadas en la tienda", () => {
    // Taller Norte no tiene encargos; Dulces de Ana no tiene guía de tallas
    expect(() => createProduct(db, tn, polera({ madeToOrder: true }), NOW)).toThrow(
      expect.objectContaining({ extra: { fields: expect.objectContaining({ madeToOrder: expect.any(String) }) } }),
    );
    expect(() => createProduct(db, ana, polera({ sizeGuideUrl: "/guia.svg" }), NOW)).toThrow(
      expect.objectContaining({ extra: { fields: expect.objectContaining({ sizeGuideUrl: expect.any(String) }) } }),
    );
  });

  it("límite del plan gratis: solo si los planes se aplican", () => {
    // Funda Lab es gratis y tiene 7 productos
    const fl = db.stores.find((s) => s.slug === "fundalab")!;
    vi.stubEnv("NEXT_PUBLIC_PLANS_ENFORCED", "true");
    for (let i = db.products.filter((p) => p.storeId === fl.id).length; i < 20; i++) createProduct(db, fl, polera({ name: `Producto ${i}` }), NOW);
    expect(() => createProduct(db, fl, polera(), NOW)).toThrow(expect.objectContaining({ status: 403, code: "plan_limit" }));
    vi.stubEnv("NEXT_PUBLIC_PLANS_ENFORCED", "false");
    expect(() => createProduct(db, fl, polera(), NOW)).not.toThrow();
  });
});

describe("updateProduct", () => {
  it("conserva ids y stock de las variantes existentes y agrega las nuevas", () => {
    const created = createProduct(db, tn, polera(), NOW);
    const input = polera();
    input.options[0]!.values.push({ value: "XL" });
    input.variants.push(
      { optionValues: ["XL", "Negro"], priceCents: 6500, active: true, lowStockThreshold: null, initialStock: 9 },
      { optionValues: ["XL", "Blanco"], priceCents: 6500, active: false, lowStockThreshold: null },
    );
    // Cambiar initialStock de una variante existente no toca su stock
    input.variants[0]!.initialStock = 100;
    input.variants[0]!.priceCents = 4900;

    const updated = updateProduct(db, tn, created.id, input, NOW);
    expect(updated.variants).toHaveLength(8);
    const sNegro = updated.variants.find((v) => v.label === "S / Negro")!;
    expect(sNegro.id).toBe(created.variants[0]!.id);
    expect(sNegro.onHand).toBe(1);
    expect(sNegro.priceCents).toBe(4900);
    expect(updated.variants.find((v) => v.label === "XL / Negro")).toMatchObject({ onHand: 9 });
    expect(updated.variants.find((v) => v.label === "XL / Blanco")).toMatchObject({ onHand: 0, active: false });
    expect(updated.priceFromCents).toBe(4900);
  });

  it("renombrar un valor conserva la variante si se envía su id", () => {
    const created = createProduct(db, tn, polera(), NOW);
    const input = polera();
    const tallaS = created.options[0]!.values[0]!;
    input.options[0]!.values[0] = { id: tallaS.id, value: "Small" };
    input.variants = input.variants.map((v, i) => ({
      ...v,
      id: created.variants[i]!.id,
      optionValues: v.optionValues.map((value) => (value === "S" ? "Small" : value)),
    }));
    const updated = updateProduct(db, tn, created.id, input, NOW);
    expect(updated.variants[0]).toMatchObject({ id: created.variants[0]!.id, label: "Small / Negro", onHand: 1 });
    expect(updated.options[0]!.values[0]).toEqual({ id: tallaS.id, value: "Small" });
  });

  it("no deja quitar una variante con unidades reservadas", () => {
    // Pedido nuevo de Sebastián Mendoza reserva un Polo Negro / L
    const polo = listProducts(db, tn).find((p) => p.name === "Polo oversize")!;
    const negroL = polo.variants.find((v) => v.label === "Negro / L")!;
    expect(negroL.reserved).toBeGreaterThan(0);

    const input: ProductInput = {
      ...polo,
      options: polo.options.map((o) => ({ ...o, values: o.name === "Talla" ? o.values.filter((v) => v.value !== "L") : o.values })),
      variants: polo.variants
        .filter((v) => !v.label.endsWith("/ L"))
        .map((v) => ({ id: v.id, optionValues: v.label.split(" / "), priceCents: v.priceCents, active: v.active, lowStockThreshold: v.lowStockThreshold })),
    };
    expect(() => updateProduct(db, tn, polo.id, input, NOW)).toThrow(expect.objectContaining({ status: 409, code: "variant_reserved" }));
    expect(listProducts(db, tn).find((p) => p.id === polo.id)!.variants).toHaveLength(12);
  });

  it("quita variantes sin reservas", () => {
    const created = createProduct(db, tn, polera(), NOW);
    const input = polera();
    input.options[1]!.values = [{ value: "Negro" }];
    input.variants = input.variants.filter((v) => v.optionValues[1] === "Negro");
    const updated = updateProduct(db, tn, created.id, input, NOW);
    expect(updated.variants.map((v) => v.label)).toEqual(["S / Negro", "M / Negro", "L / Negro"]);
    expect(db.stockItems.some((s) => s.variantId === created.variants[1]!.id)).toBe(false);
  });

  it("los pedidos siguen funcionando con las variantes editadas", () => {
    const created = createProduct(db, tn, polera(), NOW);
    const result = createOrder(
      db,
      {
        storeSlug: "tallernorte",
        items: [{ variantId: created.variants[5]!.id, quantity: 2, customValues: {} }],
        customer: { name: "Paula", phone: "987111222" },
        fulfillment: { type: "delivery", zoneId: "zn_tn_los-olivos", address: "Av. 1" },
        paymentMethod: "yape",
      },
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(getProductAdmin(db, tn, created.id).variants[5]).toMatchObject({ onHand: 6, reserved: 2, available: 4 });
  });
});

describe("setProductVisible", () => {
  it("oculta y muestra en el catálogo", () => {
    setProductVisible(db, tn, "pr_tn_gorra", { visible: false });
    expect(getCatalog(db, "tallernorte").products.map((p) => p.id)).not.toContain("pr_tn_gorra");
    setProductVisible(db, tn, "pr_tn_gorra", { visible: true });
    expect(getCatalog(db, "tallernorte").products.map((p) => p.id)).toContain("pr_tn_gorra");
  });

  it("rechaza un valor que no es sí o no", () => {
    expect(() => setProductVisible(db, tn, "pr_tn_gorra", { visible: "no" })).toThrow(expect.objectContaining({ status: 400 }));
  });
});
