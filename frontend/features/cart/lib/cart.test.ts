import { describe, expect, it } from "vitest";

import { addToCart, cartCount, cartStorageKey, parseCart, removeLine, setQuantity } from "./cart";

const torta = { variantId: "v1", quantity: 1, customValues: { Dedicatoria: "Feliz día" } };

describe("parseCart", () => {
  it("lee lo guardado", () => {
    expect(parseCart(JSON.stringify([torta]))).toEqual([torta]);
  });

  it("ignora datos vacíos, rotos o con otra forma", () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart("{roto")).toEqual([]);
    expect(parseCart(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseCart(JSON.stringify([{ variantId: 5, quantity: 1 }, "x", null]))).toEqual([]);
  });

  it("corrige cantidades fuera de rango y limpia campos extra", () => {
    expect(
      parseCart(JSON.stringify([{ variantId: "v1", quantity: 500, customValues: { a: "x", b: 3 } }, { variantId: "v2", quantity: 0 }])),
    ).toEqual([{ variantId: "v1", quantity: 99, customValues: { a: "x" } }]);
  });
});

describe("addToCart", () => {
  it("suma si es la misma variante con los mismos campos extra", () => {
    const items = addToCart(addToCart([], torta), { ...torta, quantity: 2 });
    expect(items).toEqual([{ ...torta, quantity: 3 }]);
  });

  it("separa líneas con distinta dedicatoria", () => {
    const items = addToCart([torta], { ...torta, customValues: { Dedicatoria: "Para Luis" } });
    expect(items).toHaveLength(2);
  });

  it("un campo extra vacío cuenta como sin campo", () => {
    expect(addToCart([{ variantId: "v2", quantity: 1, customValues: {} }], { variantId: "v2", quantity: 1, customValues: { Nota: "" } })).toHaveLength(1);
  });

  it("no pasa de 99", () => {
    expect(addToCart([{ ...torta, quantity: 98 }], { ...torta, quantity: 5 })[0]!.quantity).toBe(99);
  });

  it("no modifica el arreglo original", () => {
    const items = [torta];
    addToCart(items, torta);
    expect(items[0]!.quantity).toBe(1);
  });
});

describe("setQuantity, removeLine y cartCount", () => {
  const items = [torta, { variantId: "v2", quantity: 2, customValues: {} }];

  it("cambia la cantidad y con 0 quita la línea", () => {
    expect(setQuantity(items, 1, 5)[1]!.quantity).toBe(5);
    expect(setQuantity(items, 0, 0)).toEqual([items[1]]);
  });

  it("quita una línea", () => {
    expect(removeLine(items, 0)).toEqual([items[1]]);
  });

  it("cuenta las unidades", () => {
    expect(cartCount(items)).toBe(3);
    expect(cartCount([])).toBe(0);
  });

  it("una clave por tienda", () => {
    expect(cartStorageKey("dulcesdeana")).not.toBe(cartStorageKey("fundalab"));
  });
});
