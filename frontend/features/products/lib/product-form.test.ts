import { describe, expect, it } from "vitest";

import type { ProductAdmin } from "@/shared/types";

import {
  addOption,
  addOptionValues,
  applyToAllVariants,
  combinations,
  emptyProductDraft,
  type ProductDraft,
  removeOption,
  removeOptionValue,
  setDefaults,
  toProductDraft,
  toProductInput,
  validateProduct,
} from "./product-form";

const features = { madeToOrder: true, sizeGuide: true };

/** Polo con 3 tallas × 2 colores, el criterio de "listo" de F6. */
function polo(): ProductDraft {
  let d = emptyProductDraft();
  d = setDefaults({ ...d, name: "Polo oversize" }, { price: "45", stock: "5" });
  d = addOption(d, "Talla");
  d = addOptionValues(d, 0, "S, M, L");
  d = addOption(d, "Color", ["Negro", "Blanco"]);
  return d;
}

describe("combinations", () => {
  it("arma todas las combinaciones en el orden de las opciones", () => {
    expect(combinations([["S", "M"], ["Negro", "Blanco"]])).toEqual([
      ["S", "Negro"],
      ["S", "Blanco"],
      ["M", "Negro"],
      ["M", "Blanco"],
    ]);
    expect(combinations([])).toEqual([[]]);
  });
});

describe("variantes", () => {
  it("un producto sin opciones tiene una sola variante", () => {
    const d = emptyProductDraft();
    expect(d.variants).toHaveLength(1);
    expect(d.variants[0]!.values).toEqual([]);
  });

  it("3 tallas × 2 colores = 6 combinaciones con precio y stock por defecto", () => {
    const d = polo();
    expect(d.variants.map((v) => v.values.join("/"))).toEqual(["S/Negro", "S/Blanco", "M/Negro", "M/Blanco", "L/Negro", "L/Blanco"]);
    expect(d.variants.every((v) => v.price === "45" && v.stock === "5")).toBe(true);
  });

  it("conserva lo editado al agregar o quitar valores", () => {
    let d = polo();
    d = { ...d, variants: d.variants.map((v, i) => (i === 0 ? { ...v, price: "50", stock: "2" } : v)) };
    d = addOptionValues(d, 0, "XL, s");
    expect(d.variants).toHaveLength(8);
    expect(d.variants[0]).toMatchObject({ values: ["S", "Negro"], price: "50", stock: "2" });
    d = removeOptionValue(d, 1, 1);
    expect(d.variants.map((v) => v.values.join("/"))).toEqual(["S/Negro", "M/Negro", "L/Negro", "XL/Negro"]);
    expect(d.variants[0]!.price).toBe("50");
  });

  it("una opción sin valores no cuenta todavía; quitarla vuelve a la variante única", () => {
    let d = addOption(emptyProductDraft(), "Talla");
    expect(d.variants).toHaveLength(1);
    d = addOptionValues(d, 0, "S");
    d = removeOption(d, 0);
    expect(d.variants).toHaveLength(1);
    expect(d.variants[0]!.values).toEqual([]);
  });

  it("máximo 3 opciones", () => {
    let d = emptyProductDraft();
    for (let i = 0; i < 5; i++) d = addOption(d, `Opción ${i}`);
    expect(d.options).toHaveLength(3);
  });

  it("aplica el mismo precio a todas; el stock solo a las nuevas", () => {
    let d = polo();
    d = { ...d, variants: d.variants.map((v, i) => (i === 0 ? { ...v, id: "va_1" } : v)) };
    d = applyToAllVariants(d, { price: "49", stock: "3" });
    expect(d.variants.every((v) => v.price === "49")).toBe(true);
    expect(d.variants[0]!.stock).toBe("5");
    expect(d.variants[1]!.stock).toBe("3");
  });
});

describe("validateProduct", () => {
  it("el polo completo es válido", () => {
    expect(validateProduct(polo(), features)).toEqual({});
  });

  it("pide nombre, precio y stock", () => {
    const d = emptyProductDraft();
    expect(Object.keys(validateProduct(setDefaults(d, { stock: "" }), features)).sort()).toEqual(
      ["name", "variants.0.initialStock", "variants.0.priceCents"].sort(),
    );
  });

  it("por encargo no pide stock", () => {
    const d = { ...setDefaults(emptyProductDraft(), { price: "50", stock: "" }), name: "Torta", madeToOrder: true };
    expect(validateProduct(d, features)).toEqual({});
    expect(validateProduct(d, { ...features, madeToOrder: false }).madeToOrder).toBeDefined();
  });

  it("opciones sin nombre, sin valores o repetidas", () => {
    let d = polo();
    d = addOption(d, "talla");
    expect(validateProduct(d, features)).toMatchObject({ "options.2.name": expect.any(String), "options.2.values": expect.any(String) });
  });

  it("campos extra: nombre y largo máximo", () => {
    const d: ProductDraft = {
      ...polo(),
      customFields: [
        { key: "a", label: "Dedicatoria", required: false, maxLength: "60" },
        { key: "b", label: "dedicatoria", required: true, maxLength: "0" },
      ],
    };
    expect(Object.keys(validateProduct(d, features))).toEqual(["customFields.1.label", "customFields.1.maxLength"]);
  });

  it("al menos una combinación activa", () => {
    const d = polo();
    expect(validateProduct({ ...d, variants: d.variants.map((v) => ({ ...v, active: false })) }, features).variants).toBeDefined();
  });
});

describe("toProductInput", () => {
  it("arma el producto nuevo con stock inicial por combinación", () => {
    const input = toProductInput({ ...polo(), lowStockThreshold: "2" });
    expect(input.options).toEqual([
      { name: "Talla", values: [{ value: "S" }, { value: "M" }, { value: "L" }] },
      { name: "Color", values: [{ value: "Negro" }, { value: "Blanco" }] },
    ]);
    expect(input.variants).toHaveLength(6);
    expect(input.variants[0]).toEqual({
      optionValues: ["S", "Negro"],
      priceCents: 4500,
      active: true,
      lowStockThreshold: 2,
      initialStock: 5,
    });
  });

  it("por encargo no manda stock ni aviso", () => {
    const base = setDefaults(emptyProductDraft(), { price: "50" });
    const input = toProductInput({ ...base, name: "Torta", madeToOrder: true, lowStockThreshold: "3" });
    expect(input.variants).toEqual([{ optionValues: [], priceCents: 5000, active: true, lowStockThreshold: null }]);
  });
});

describe("toProductDraft", () => {
  const product: ProductAdmin = {
    id: "pr_1",
    categoryId: "ca_1",
    name: "Polo",
    description: "",
    images: [],
    madeToOrder: false,
    sizeGuideUrl: null,
    visible: true,
    position: 0,
    priceFromCents: 4500,
    options: [
      { id: "op_t", name: "Talla", values: [{ id: "ov_s", value: "S" }, { id: "ov_m", value: "M" }] },
    ],
    variants: [
      { id: "va_s", optionValueIds: ["ov_s"], label: "S", priceCents: 4500, available: 3, lowStock: false, active: true, onHand: 4, reserved: 1, lowStockThreshold: 2 },
      { id: "va_m", optionValueIds: ["ov_m"], label: "M", priceCents: 4900, available: 0, lowStock: true, active: true, onHand: 0, reserved: 0, lowStockThreshold: 2 },
    ],
    customFields: [{ id: "cf_1", label: "Nombre", required: true, maxLength: 20 }],
  };

  it("conserva ids y stock actual, y al reenviar no manda stock inicial", () => {
    const d = toProductDraft(product);
    expect(d.price).toBe("45");
    expect(d.lowStockThreshold).toBe("2");
    expect(d.variants[1]).toMatchObject({ id: "va_m", values: ["M"], price: "49", current: { onHand: 0, reserved: 0 } });
    const input = toProductInput(d);
    expect(input.options[0]).toEqual({ id: "op_t", name: "Talla", values: [{ id: "ov_s", value: "S" }, { id: "ov_m", value: "M" }] });
    expect(input.variants[0]).toEqual({ id: "va_s", optionValues: ["S"], priceCents: 4500, active: true, lowStockThreshold: 2 });
    expect(input.customFields).toEqual([{ id: "cf_1", label: "Nombre", required: true, maxLength: 20 }]);
  });
});
