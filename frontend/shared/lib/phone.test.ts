import { describe, expect, it } from "vitest";

import { formatPeruPhone, isValidPeruPhone, normalizePeruPhone, toWhatsAppNumber } from "./phone";

describe("normalizePeruPhone", () => {
  it.each([
    ["987654321", "987654321"],
    ["987 654 321", "987654321"],
    ["987-654-321", "987654321"],
    [" 987 654 321 ", "987654321"],
    ["+51 987 654 321", "987654321"],
    ["51987654321", "987654321"],
    ["(+51) 987-654-321", "987654321"],
  ])("acepta %j", (input, expected) => {
    expect(normalizePeruPhone(input)).toBe(expected);
  });

  it.each([
    ["", "vacío"],
    ["87654321", "8 dígitos"],
    ["9876543210", "10 dígitos"],
    ["887654321", "no empieza con 9"],
    ["014567890", "teléfono fijo"],
    ["+52 987 654 321", "otro país"],
    ["5198765432", "51 con 8 dígitos"],
    ["98765432a", "con letras"],
    ["9876+54321", "+ en medio"],
  ])("rechaza %j (%s)", (input) => {
    expect(normalizePeruPhone(input)).toBeNull();
  });
});

describe("isValidPeruPhone", () => {
  it("dice si es un celular peruano", () => {
    expect(isValidPeruPhone("912 345 678")).toBe(true);
    expect(isValidPeruPhone("12345")).toBe(false);
  });
});

describe("formatPeruPhone", () => {
  it("agrupa de a tres dígitos", () => {
    expect(formatPeruPhone("987654321")).toBe("987 654 321");
  });

  it("quita el 51 del número de WhatsApp de la tienda", () => {
    expect(formatPeruPhone("51912345678")).toBe("912 345 678");
  });

  it("devuelve el texto tal cual si no es válido", () => {
    expect(formatPeruPhone("12345")).toBe("12345");
  });
});

describe("toWhatsAppNumber", () => {
  it("agrega el prefijo 51", () => {
    expect(toWhatsAppNumber("987 654 321")).toBe("51987654321");
    expect(toWhatsAppNumber("+51 987 654 321")).toBe("51987654321");
  });

  it("devuelve null si no es válido", () => {
    expect(toWhatsAppNumber("12345")).toBeNull();
  });
});
