import { describe, expect, it } from "vitest";

import type { StockItemRecord } from "../types";
import { applyStockMovement, availableOf, StockRuleError } from "./stock";

const item = (onHand: number, reserved: number): StockItemRecord => ({
  variantId: "va_1",
  storeId: "st_1",
  onHand,
  reserved,
  lowStockThreshold: null,
});

describe("applyStockMovement", () => {
  it("reserve aparta unidades sin tocar el total", () => {
    const { item: next, signedQuantity } = applyStockMovement(item(5, 1), "reserve", 2);
    expect(next).toMatchObject({ onHand: 5, reserved: 3 });
    expect(availableOf(next)).toBe(2);
    expect(signedQuantity).toBe(-2);
  });

  it("reserve falla si no alcanza lo disponible", () => {
    expect(() => applyStockMovement(item(5, 4), "reserve", 2)).toThrow(StockRuleError);
  });

  it("release libera lo reservado", () => {
    const { item: next, signedQuantity } = applyStockMovement(item(5, 3), "release", 2);
    expect(next).toMatchObject({ onHand: 5, reserved: 1 });
    expect(signedQuantity).toBe(2);
    expect(() => applyStockMovement(item(5, 1), "release", 2)).toThrow(StockRuleError);
  });

  it("sale descuenta del total y de lo reservado", () => {
    const { item: next, signedQuantity } = applyStockMovement(item(5, 2), "sale", 2);
    expect(next).toMatchObject({ onHand: 3, reserved: 0 });
    expect(signedQuantity).toBe(-2);
    expect(() => applyStockMovement(item(5, 1), "sale", 2)).toThrow(StockRuleError);
  });

  it("in suma al total", () => {
    const { item: next, signedQuantity } = applyStockMovement(item(5, 2), "in", 3);
    expect(next).toMatchObject({ onHand: 8, reserved: 2 });
    expect(signedQuantity).toBe(3);
  });

  it("out resta del total, pero nunca deja onHand < reserved", () => {
    expect(applyStockMovement(item(5, 2), "out", 3).item).toMatchObject({ onHand: 2, reserved: 2 });
    expect(() => applyStockMovement(item(5, 2), "out", 4)).toThrow(StockRuleError);
  });

  it("adjust fija el total exacto y guarda la diferencia", () => {
    expect(applyStockMovement(item(5, 2), "adjust", 9)).toMatchObject({ item: { onHand: 9 }, signedQuantity: 4 });
    expect(applyStockMovement(item(5, 2), "adjust", 2)).toMatchObject({ item: { onHand: 2 }, signedQuantity: -3 });
    expect(() => applyStockMovement(item(5, 2), "adjust", 1)).toThrow(StockRuleError);
  });

  it("no modifica el stock original", () => {
    const original = item(5, 0);
    applyStockMovement(original, "in", 3);
    expect(original.onHand).toBe(5);
  });

  it("rechaza cantidades no válidas", () => {
    expect(() => applyStockMovement(item(5, 0), "in", 0)).toThrow(StockRuleError);
    expect(() => applyStockMovement(item(5, 0), "in", -1)).toThrow(StockRuleError);
    expect(() => applyStockMovement(item(5, 0), "in", 1.5)).toThrow(StockRuleError);
  });
});
