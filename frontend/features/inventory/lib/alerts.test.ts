import { describe, expect, it } from "vitest";

import type { ProductAdmin, VariantAdmin } from "@/shared/types";

import { lowStockItems, variantName } from "./alerts";

const v = (id: string, over: Partial<VariantAdmin>): VariantAdmin => ({
  id,
  optionValueIds: [],
  label: "",
  priceCents: 1000,
  available: 0,
  lowStock: false,
  active: true,
  onHand: 10,
  reserved: 0,
  lowStockThreshold: 2,
  ...over,
});
const p = (name: string, variants: VariantAdmin[], madeToOrder = false) =>
  ({ id: name, name, madeToOrder, variants }) as unknown as ProductAdmin;

describe("lowStockItems", () => {
  const products = [
    p("Cheesecake", [v("a", { onHand: 2, lowStock: true })]),
    p("Keke", [v("b", { onHand: 0 })]),
    p("Alfajores", [v("c", { onHand: 10 })]),
    p("Tres leches", [v("d", { onHand: 0 })], true),
    p("Polo", [v("e", { onHand: 0, active: false }), v("f", { onHand: 3, reserved: 3, label: "M" })]),
  ];

  it("solo las que piden reponer, agotadas primero", () => {
    expect(lowStockItems(products, true).map((i) => i.variant.id)).toEqual(["b", "f", "a"]);
  });

  it("si la tienda apagó los encargos, el producto por encargo cuenta como normal", () => {
    expect(lowStockItems(products, false).map((i) => i.variant.id)).toContain("d");
  });

  it("nombre con la combinación", () => {
    const [polo] = lowStockItems([products[4]!], true);
    expect(variantName(polo!)).toBe("Polo · M");
  });
});
