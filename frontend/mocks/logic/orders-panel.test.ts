import { beforeEach, describe, expect, it } from "vitest";

import { resetDb } from "../db";
import type { MockDb, StoreRecord } from "../types";
import { findOrder, listOrders, updateOrderNotes } from "./orders";

const NOW = new Date("2026-10-31T15:00:00Z");

let db: MockDb;
let ana: StoreRecord;
beforeEach(() => {
  db = resetDb(NOW);
  ana = db.stores.find((s) => s.slug === "dulcesdeana")!;
});

describe("listOrders", () => {
  it("devuelve los pedidos de la tienda, los más recientes primero", () => {
    const orders = listOrders(db, ana.id, {});
    expect(orders.length).toBe(db.orders.filter((o) => o.storeId === ana.id).length);
    expect(orders[0]!.number).toBe(42);
    expect(orders.map((o) => o.createdAt)).toEqual([...orders.map((o) => o.createdAt)].sort().reverse());
    expect(orders[0]).not.toHaveProperty("storeId");
    expect(orders[0]).toHaveProperty("id");
    expect(orders[0]).toHaveProperty("notes");
  });

  it("filtra por estado", () => {
    const orders = listOrders(db, ana.id, { status: "new" });
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.status === "new")).toBe(true);
  });

  it.each([
    ["maria", 42],
    ["María López", 42],
    ["42", 42],
    ["#0042", 42],
    ["987 654", 42],
  ])("busca %j", (search, number) => {
    expect(listOrders(db, ana.id, { search }).map((o) => o.number)).toContain(number);
  });

  it("no mezcla tiendas", () => {
    const fl = db.stores.find((s) => s.slug === "fundalab")!;
    expect(listOrders(db, fl.id, { search: "maria" })).toEqual([]);
  });

  it("rechaza un estado desconocido", () => {
    expect(() => listOrders(db, ana.id, { status: "abierto" })).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("updateOrderNotes", () => {
  it("guarda y borra la nota interna", () => {
    const order = findOrder(db, ana.id, "or_da_42");
    updateOrderNotes(order, { notes: "  Llamar antes de ir  " });
    expect(order.notes).toBe("Llamar antes de ir");
    updateOrderNotes(order, { notes: "" });
    expect(order.notes).toBeNull();
    updateOrderNotes(order, { notes: null });
    expect(order.notes).toBeNull();
  });

  it("rechaza notas muy largas o que no son texto", () => {
    const order = findOrder(db, ana.id, "or_da_42");
    expect(() => updateOrderNotes(order, { notes: "x".repeat(501) })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => updateOrderNotes(order, { notes: 5 })).toThrow(expect.objectContaining({ status: 400 }));
  });

  it("findOrder no encuentra pedidos de otra tienda", () => {
    const fl = db.stores.find((s) => s.slug === "fundalab")!;
    expect(() => findOrder(db, fl.id, "or_da_42")).toThrow(expect.objectContaining({ status: 404 }));
  });
});
