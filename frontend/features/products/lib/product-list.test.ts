import { describe, expect, it } from "vitest";

import type { ProductAdmin, VariantAdmin } from "@/shared/types";

import { matchesFilter, summarizeProduct } from "./product-list";

const variant = (over: Partial<VariantAdmin>): VariantAdmin => ({
  id: "v",
  optionValueIds: [],
  label: "",
  priceCents: 4500,
  available: 0,
  lowStock: false,
  active: true,
  onHand: 0,
  reserved: 0,
  lowStockThreshold: null,
  ...over,
});

const product = (over: Partial<ProductAdmin>): ProductAdmin => ({
  id: "p",
  categoryId: "c1",
  name: "Torta de chocolate",
  description: "",
  images: [],
  madeToOrder: false,
  sizeGuideUrl: null,
  visible: true,
  position: 0,
  options: [],
  variants: [variant({ onHand: 10, reserved: 1 })],
  customFields: [],
  priceFromCents: 4500,
  ...over,
});

describe("summarizeProduct", () => {
  it("disponible: suma lo disponible de las variantes activas", () => {
    expect(summarizeProduct(product({}), true)).toMatchObject({ status: "available", available: 9, reserved: 1, priceLabel: "S/ 45.00" });
  });

  it("stock bajo si alguna variante lo está o se agotó", () => {
    expect(summarizeProduct(product({ variants: [variant({ onHand: 2, lowStock: true })] }), true).status).toBe("low");
    const mixed = product({
      options: [{ id: "o", name: "Tamaño", values: [] }],
      variants: [variant({ onHand: 5 }), variant({ onHand: 0, priceCents: 7000 })],
    });
    expect(summarizeProduct(mixed, true)).toMatchObject({ status: "low", priceLabel: "Desde S/ 45.00", variantsLabel: "2 combinaciones" });
  });

  it("agotado si no queda nada disponible", () => {
    expect(summarizeProduct(product({ variants: [variant({ onHand: 2, reserved: 2 })] }), true).status).toBe("out");
  });

  it("por encargo solo si la tienda tiene la función activa", () => {
    const made = product({ madeToOrder: true, variants: [variant({})] });
    expect(summarizeProduct(made, true)).toMatchObject({ status: "madeToOrder", available: null });
    expect(summarizeProduct(made, false).status).toBe("out");
  });
});

describe("matchesFilter", () => {
  const p = product({ visible: false });
  const s = summarizeProduct(p, true);
  it("busca sin importar tildes ni mayúsculas", () => {
    expect(matchesFilter(p, s, { filter: "all", search: "CHOCOLATÉ", categoryId: null })).toBe(true);
    expect(matchesFilter(p, s, { filter: "all", search: "keke", categoryId: null })).toBe(false);
  });
  it("filtra por categoría, estado y ocultos", () => {
    expect(matchesFilter(p, s, { filter: "all", search: "", categoryId: "c2" })).toBe(false);
    expect(matchesFilter(p, s, { filter: "available", search: "", categoryId: "c1" })).toBe(true);
    expect(matchesFilter(p, s, { filter: "hidden", search: "", categoryId: null })).toBe(true);
    expect(matchesFilter(p, s, { filter: "out", search: "", categoryId: null })).toBe(false);
  });
});
