import { describe, expect, it } from "vitest";

import type { Product, Variant } from "@/shared/types";

import { catalogAvailability, fitCartToStock, reportedAvailability } from "./stock";

const line = (variantId: string, quantity: number, customValues: Record<string, string> = {}) => ({
  variantId,
  quantity,
  customValues,
});

describe("fitCartToStock", () => {
  it("no cambia nada si todo alcanza (y devuelve el mismo arreglo)", () => {
    const items = [line("a", 2), line("b", 1)];
    const result = fitCartToStock(items, () => 5);
    expect(result.adjustments).toEqual([]);
    expect(result.items).toBe(items);
  });

  it("baja la cantidad a lo disponible y quita lo agotado", () => {
    const items = [line("a", 3), line("b", 2)];
    const result = fitCartToStock(items, (id) => (id === "a" ? 1 : 0));
    expect(result.items).toEqual([line("a", 1)]);
    expect(result.adjustments).toEqual([
      { item: line("a", 3), from: 3, to: 1 },
      { item: line("b", 2), from: 2, to: 0 },
    ]);
  });

  it("reparte el stock en orden entre líneas de la misma variante", () => {
    const items = [line("a", 2, { Nombre: "Ana" }), line("a", 2, { Nombre: "Luis" })];
    const result = fitCartToStock(items, () => 3);
    expect(result.items).toEqual([line("a", 2, { Nombre: "Ana" }), line("a", 1, { Nombre: "Luis" })]);
    expect(result.adjustments).toHaveLength(1);
  });
});

const variant = (id: string, available: number, active = true): Variant =>
  ({ id, available, active, lowStock: false, priceCents: 1000, label: "", optionValueIds: [] }) as unknown as Variant;

describe("catalogAvailability", () => {
  const products = [
    { madeToOrder: false, variants: [variant("a", 4), variant("b", 9, false)] },
    { madeToOrder: true, variants: [variant("c", 0)] },
  ] as unknown as Product[];
  const availableOf = catalogAvailability(products);

  it("usa lo disponible de cada variante", () => expect(availableOf("a")).toBe(4));
  it("las inactivas y las que no están en el catálogo cuentan como 0", () => {
    expect(availableOf("b")).toBe(0);
    expect(availableOf("x")).toBe(0);
  });
  it("lo que es por encargo no tiene límite de stock", () => expect(availableOf("c")).toBe(99));
});

describe("reportedAvailability", () => {
  it("las variantes que no reportó la API no tienen problema", () => {
    const availableOf = reportedAvailability([{ variantId: "a", available: 1 }]);
    expect(availableOf("a")).toBe(1);
    expect(availableOf("b")).toBe(Number.POSITIVE_INFINITY);
  });
});
