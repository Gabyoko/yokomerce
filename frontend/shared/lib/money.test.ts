import { describe, expect, it } from "vitest";

import { centsToInput, formatSoles, parseSolesInput } from "./money";

describe("formatSoles", () => {
  it("convierte céntimos a soles con dos decimales", () => {
    expect(formatSoles(4500)).toBe("S/ 45.00");
    expect(formatSoles(11600)).toBe("S/ 116.00");
    expect(formatSoles(1850)).toBe("S/ 18.50");
    expect(formatSoles(5)).toBe("S/ 0.05");
  });

  it("separa los miles con coma, como en es-PE", () => {
    expect(formatSoles(124000)).toBe("S/ 1,240.00");
    expect(formatSoles(123456789)).toBe("S/ 1,234,567.89");
  });

  it("muestra cero", () => {
    expect(formatSoles(0)).toBe("S/ 0.00");
  });

  it("pone el signo antes de S/ en montos negativos", () => {
    expect(formatSoles(-1500)).toBe("-S/ 15.00");
  });

  it("usa un espacio normal después de S/", () => {
    expect(formatSoles(100)).toBe("S/ 1.00");
  });

  it("puede ocultar .00 en montos exactos", () => {
    expect(formatSoles(4500, { trimZeroDecimals: true })).toBe("S/ 45");
    expect(formatSoles(124000, { trimZeroDecimals: true })).toBe("S/ 1,240");
    expect(formatSoles(4550, { trimZeroDecimals: true })).toBe("S/ 45.50");
  });

  it("redondea si llega un valor con decimales", () => {
    expect(formatSoles(4499.6)).toBe("S/ 45.00");
  });
});

describe("parseSolesInput", () => {
  it("entiende lo que escribe la gente", () => {
    expect(parseSolesInput("8")).toBe(800);
    expect(parseSolesInput("8.5")).toBe(850);
    expect(parseSolesInput("8,50")).toBe(850);
    expect(parseSolesInput(" S/ 1,240.00 ")).toBe(124000);
    expect(parseSolesInput("0")).toBe(0);
  });

  it("rechaza lo que no es un monto", () => {
    expect(parseSolesInput("")).toBeNull();
    expect(parseSolesInput("abc")).toBeNull();
    expect(parseSolesInput("-5")).toBeNull();
    expect(parseSolesInput("8.555")).toBeNull();
  });
});

describe("centsToInput", () => {
  it("muestra decimales solo si hay céntimos", () => {
    expect(centsToInput(800)).toBe("8");
    expect(centsToInput(850)).toBe("8.50");
    expect(centsToInput(1505)).toBe("15.05");
  });
});
