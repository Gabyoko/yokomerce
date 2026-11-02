import { describe, expect, it } from "vitest";

import { movementLabel, previewAdjustment, reasonLabel, signedQuantity } from "./adjust";

const stock = { onHand: 10, reserved: 1 };

describe("previewAdjustment", () => {
  it("entrada suma, salida resta, corregir fija el total", () => {
    expect(previewAdjustment(stock, "in", 12)).toEqual({ ok: true, onHand: 22, available: 21 });
    expect(previewAdjustment(stock, "out", 3)).toEqual({ ok: true, onHand: 7, available: 6 });
    expect(previewAdjustment(stock, "adjust", 4)).toEqual({ ok: true, onHand: 4, available: 3 });
  });

  it("no deja sacar lo reservado ni corregir por debajo", () => {
    expect(previewAdjustment(stock, "out", 10)).toMatchObject({ ok: false, message: expect.stringMatching(/Solo puedes sacar 9/) });
    expect(previewAdjustment(stock, "adjust", 0)).toMatchObject({ ok: false, message: expect.stringMatching(/1 reservados/) });
    expect(previewAdjustment({ onHand: 0, reserved: 0 }, "out", 1)).toMatchObject({ ok: false });
  });

  it("cantidades inválidas", () => {
    expect(previewAdjustment(stock, "in", 0).ok).toBe(false);
    expect(previewAdjustment(stock, "in", 1.5).ok).toBe(false);
    expect(previewAdjustment({ onHand: 0, reserved: 0 }, "adjust", 0)).toEqual({ ok: true, onHand: 0, available: 0 });
  });
});

describe("textos de movimientos", () => {
  it("con pedido o motivo", () => {
    expect(movementLabel({ type: "reserve", reason: null, orderNumber: 42 })).toBe("Reserva · pedido #0042");
    expect(movementLabel({ type: "in", reason: "produccion", orderNumber: null })).toBe("Entrada · Producción");
    expect(movementLabel({ type: "out", reason: "algo propio", orderNumber: null })).toBe("Salida · algo propio");
    expect(movementLabel({ type: "adjust", reason: null, orderNumber: null })).toBe("Corrección");
  });

  it("signo y motivo", () => {
    expect(signedQuantity(12)).toBe("+12");
    expect(signedQuantity(-3)).toBe("−3");
    expect(reasonLabel("venta_tienda")).toBe("Venta en tienda");
    expect(reasonLabel(null)).toBeNull();
  });
});
