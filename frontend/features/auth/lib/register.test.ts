import { describe, expect, it } from "vitest";

import { createStoreInput, emptyRegisterDraft, type RegisterDraft, registerZones, validateRegisterStep } from "./register";

const filled: RegisterDraft = {
  ownerName: "Ana Torres",
  name: "Dulces de Ana",
  slug: "dulces-ana",
  whatsapp: "912 345 678",
  city: "Santiago de Surco",
  delivery: true,
  zones: [{ key: "a", name: "Surco", price: "8" }],
  answers: { deliveryDate: true, madeToOrder: true, variants: false, shipping: false },
};

describe("validateRegisterStep", () => {
  it("un registro completo no tiene errores en ningún paso", () => {
    for (const step of [1, 2, 3]) expect(validateRegisterStep(step, filled, "available")).toEqual({});
  });

  it("paso 1 pide el nombre", () => {
    expect(validateRegisterStep(1, emptyRegisterDraft(), "idle")).toEqual({ ownerName: "Escribe tu nombre." });
  });

  it("paso 2: el link debe estar libre", () => {
    expect(validateRegisterStep(2, filled, "taken").slug).toMatch(/en uso/);
    expect(validateRegisterStep(2, filled, "checking").slug).toMatch(/revisando/);
    expect(validateRegisterStep(2, { ...filled, slug: "panel" }, "available").slug).toMatch(/reservado/);
  });

  it("paso 2: delivery necesita zonas con nombre y precio", () => {
    expect(validateRegisterStep(2, { ...filled, zones: [] }, "available").zones).toBeDefined();
    const bad = { ...filled, zones: [{ key: "a", name: "", price: "x" }] };
    expect(Object.keys(validateRegisterStep(2, bad, "available"))).toEqual(["zones.0.name", "zones.0.priceCents"]);
    expect(validateRegisterStep(2, { ...filled, delivery: false, zones: [] }, "available")).toEqual({});
  });

  it("paso 3: las 4 preguntas son obligatorias", () => {
    expect(Object.keys(validateRegisterStep(3, emptyRegisterDraft(), "idle"))).toHaveLength(4);
  });
});

describe("createStoreInput", () => {
  it("arma el registro sin la pregunta de variantes", () => {
    expect(createStoreInput(filled)).toEqual({
      ownerName: "Ana Torres",
      name: "Dulces de Ana",
      slug: "dulces-ana",
      whatsapp: "912345678",
      city: "Santiago de Surco",
      answers: { deliveryDate: true, madeToOrder: true, shipping: false },
    });
  });

  it("las zonas solo si hace delivery", () => {
    expect(registerZones(filled)).toEqual([{ name: "Surco", priceCents: 800, active: true }]);
    expect(registerZones({ ...filled, delivery: false })).toEqual([]);
  });
});
