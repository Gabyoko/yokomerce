import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDb } from "../db";
import type { MockDb } from "../types";
import { MockApiError } from "./errors";
import { adjustStock, listStockMovements } from "./inventory";
import { createOrder } from "./orders";

const NOW = new Date("2026-10-31T15:00:00Z");
const ALFAJORES = "va_da_alfajores-x12";

let db: MockDb;
let storeId: string;
beforeEach(() => {
  db = resetDb(NOW);
  storeId = db.stores.find((s) => s.slug === "dulcesdeana")!.id;
});

const stock = (variantId: string) => db.stockItems.find((s) => s.variantId === variantId)!;

describe("adjustStock", () => {
  it("in suma al total y devuelve el movimiento y la variante actualizada", () => {
    const before = stock(ALFAJORES).onHand;
    const { movement, variant } = adjustStock(db, storeId, ALFAJORES, { type: "in", quantity: 10, reason: "produccion" }, "Ana Torres", NOW);
    expect(stock(ALFAJORES).onHand).toBe(before + 10);
    expect(movement).toMatchObject({ type: "in", quantity: 10, reason: "produccion", createdBy: "Ana Torres", orderNumber: null });
    expect(movement).not.toHaveProperty("storeId");
    expect(variant).toMatchObject({ id: ALFAJORES, onHand: before + 10 });
  });

  it("out resta del total", () => {
    const before = stock(ALFAJORES).onHand;
    adjustStock(db, storeId, ALFAJORES, { type: "out", quantity: 3, reason: "merma" }, "Ana", NOW);
    expect(stock(ALFAJORES).onHand).toBe(before - 3);
  });

  it("adjust fija el total exacto", () => {
    const { movement, variant } = adjustStock(db, storeId, ALFAJORES, { type: "adjust", quantity: 40, reason: "correccion" }, "Ana", NOW);
    expect(stock(ALFAJORES).onHand).toBe(40);
    expect(movement.type).toBe("adjust");
    expect(variant.available).toBe(40 - stock(ALFAJORES).reserved);
  });

  it("nunca deja el total por debajo de lo reservado", () => {
    createOrder(
      db,
      {
        storeSlug: "dulcesdeana",
        items: [{ variantId: ALFAJORES, quantity: 5, customValues: {} }],
        customer: { name: "Paula", phone: "987111222" },
        fulfillment: { type: "pickup" },
        deliveryDate: "2026-11-02",
        paymentMethod: "yape",
      },
      NOW,
    );
    const { reserved } = stock(ALFAJORES);
    expect(reserved).toBeGreaterThan(0);
    expect(() => adjustStock(db, storeId, ALFAJORES, { type: "adjust", quantity: reserved - 1, reason: "correccion" }, "Ana", NOW)).toThrow(
      expect.objectContaining({ status: 409, code: "stock_conflict" }),
    );
    const available = stock(ALFAJORES).onHand - reserved;
    expect(() => adjustStock(db, storeId, ALFAJORES, { type: "out", quantity: available + 1, reason: "merma" }, "Ana", NOW)).toThrow(MockApiError);
  });

  it.each([
    [{ type: "move", quantity: 1, reason: "x" }, "type"],
    [{ type: "in", quantity: 0, reason: "x" }, "quantity"],
    [{ type: "in", quantity: -2, reason: "x" }, "quantity"],
    [{ type: "in", quantity: 1.5, reason: "x" }, "quantity"],
    [{ type: "in", quantity: 1, reason: " " }, "reason"],
  ])("valida los datos: %j", (body, field) => {
    expect(() => adjustStock(db, storeId, ALFAJORES, body, "Ana", NOW)).toThrow(
      expect.objectContaining({ status: 400, extra: { fields: expect.objectContaining({ [field]: expect.any(String) }) } }),
    );
  });

  it("rechaza productos por encargo", () => {
    expect(() => adjustStock(db, storeId, "va_da_torta-tres-leches", { type: "in", quantity: 1, reason: "x" }, "Ana", NOW)).toThrow(
      expect.objectContaining({ code: "made_to_order" }),
    );
  });

  it("no permite tocar variantes de otra tienda", () => {
    expect(() => adjustStock(db, storeId, "va_fl_cargador-rapido", { type: "in", quantity: 1, reason: "x" }, "Ana", NOW)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});

describe("listStockMovements", () => {
  const store = () => db.stores.find((s) => s.id === storeId)!;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("devuelve el historial de la variante, el más reciente primero", () => {
    adjustStock(db, storeId, ALFAJORES, { type: "in", quantity: 3, reason: "produccion" }, "Ana", NOW);
    const movements = listStockMovements(db, store(), ALFAJORES, NOW);
    expect(movements[0]).toMatchObject({ type: "in", quantity: 3, reason: "produccion" });
    expect(movements.every((m) => m.variantId === ALFAJORES)).toBe(true);
    expect(movements.length).toBeGreaterThan(1);
  });

  it("en la beta todos lo ven; con planes activos es solo para Pro", () => {
    vi.stubEnv("NEXT_PUBLIC_PLANS_ENFORCED", "true");
    expect(() => listStockMovements(db, store(), ALFAJORES, NOW)).toThrow(
      expect.objectContaining({ status: 403, code: "plan_required" }),
    );
    store().plan = "pro";
    expect(listStockMovements(db, store(), ALFAJORES, NOW).length).toBeGreaterThan(0);
  });

  it("404 para variantes de otra tienda", () => {
    expect(() => listStockMovements(db, store(), "va_fl_cargador-rapido", NOW)).toThrow(expect.objectContaining({ status: 404 }));
  });
});
