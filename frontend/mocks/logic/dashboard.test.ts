import { beforeEach, describe, expect, it } from "vitest";

import { todayInLima } from "@/shared/lib/dates";

import { resetDb } from "../db";
import type { MockDb, StoreRecord } from "../types";
import { getDashboardStats } from "./dashboard";
import { confirmPayment, createOrder } from "./orders";

const NOW = new Date("2026-10-31T15:00:00Z");

let db: MockDb;
let ana: StoreRecord;
beforeEach(() => {
  db = resetDb(NOW);
  ana = db.stores.find((s) => s.slug === "dulcesdeana")!;
});

describe("getDashboardStats", () => {
  it("cuenta con los pedidos de la tienda", () => {
    const stats = getDashboardStats(db, ana, NOW);
    const orders = db.orders.filter((o) => o.storeId === ana.id);

    expect(stats.pendingConfirmation).toBe(orders.filter((o) => o.status === "new").length);
    expect(stats.ordersToday).toBe(
      orders.filter((o) => todayInLima(new Date(o.createdAt)) === "2026-10-31" && !["cancelled", "expired"].includes(o.status)).length,
    );
    expect(stats.ordersWeek).toBeGreaterThan(0);
    expect(stats.averageTicketCents).toBe(Math.round(stats.salesWeekCents / stats.ordersWeek));
    expect(stats.lowStockCount).toBeGreaterThan(0);
  });

  it("las ventas solo cuentan pedidos con pago confirmado", () => {
    const before = getDashboardStats(db, ana, NOW);
    const result = createOrder(
      db,
      {
        storeSlug: "dulcesdeana",
        items: [{ variantId: "va_da_alfajores-x12", quantity: 2, customValues: {} }],
        customer: { name: "Paula", phone: "987111222" },
        fulfillment: { type: "pickup" },
        deliveryDate: "2026-11-02",
        paymentMethod: "yape",
      },
      NOW,
    );
    expect(result.ok).toBe(true);
    const afterCreate = getDashboardStats(db, ana, NOW);
    expect(afterCreate.salesWeekCents).toBe(before.salesWeekCents);
    expect(afterCreate.pendingConfirmation).toBe(before.pendingConfirmation + 1);
    expect(afterCreate.ordersToday).toBe(before.ordersToday + 1);

    const order = db.orders.at(-1)!;
    confirmPayment(db, order, "Ana", NOW);
    const afterPay = getDashboardStats(db, ana, NOW);
    expect(afterPay.salesWeekCents).toBe(before.salesWeekCents + 3600);
    expect(afterPay.ordersWeek).toBe(before.ordersWeek + 1);
  });

  it("lo más vendido ordenado por unidades, máximo 5", () => {
    const { topProducts } = getDashboardStats(db, ana, NOW);
    expect(topProducts.length).toBeLessThanOrEqual(5);
    const units = topProducts.map((p) => p.units);
    expect(units).toEqual([...units].sort((a, b) => b - a));
    expect(topProducts[0]!.name).toBe("Torta de chocolate");
  });

  it("una tienda sin pedidos da todo en cero", () => {
    db.orders = db.orders.filter((o) => o.storeId !== ana.id);
    expect(getDashboardStats(db, ana, NOW)).toMatchObject({
      ordersToday: 0,
      pendingConfirmation: 0,
      salesWeekCents: 0,
      ordersWeek: 0,
      averageTicketCents: 0,
      topProducts: [],
    });
  });
});
