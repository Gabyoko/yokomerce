import { addDays, todayInLima } from "@/shared/lib/dates";
import type { DashboardStats } from "@/shared/types";

import type { MockDb, StoreRecord } from "../types";
import { toProductAdmin } from "./catalog";

const TOP_PRODUCTS = 5;
const SOLD_STATUSES = new Set(["paid", "preparing", "delivered"]);

/**
 * GET /me/stats
 * - Hoy y la semana se cuentan en días de Lima; la semana son los últimos 7 días incluyendo hoy.
 * - Pedidos de hoy: los creados hoy, sin contar cancelados ni vencidos.
 * - Ventas: pedidos con pago confirmado (pagado, preparando o entregado), por fecha de pago.
 */
export function getDashboardStats(db: MockDb, store: StoreRecord, now: Date = new Date()): DashboardStats {
  const today = todayInLima(now);
  const weekStart = addDays(today, -6);
  const orders = db.orders.filter((o) => o.storeId === store.id);

  const ordersToday = orders.filter(
    (o) => todayInLima(new Date(o.createdAt)) === today && o.status !== "cancelled" && o.status !== "expired",
  ).length;

  const sold = orders.filter(
    (o) => SOLD_STATUSES.has(o.status) && o.paidAt !== null && todayInLima(new Date(o.paidAt)) >= weekStart,
  );
  const salesWeekCents = sold.reduce((sum, o) => sum + o.totalCents, 0);

  const units = new Map<string, number>();
  for (const item of sold.flatMap((o) => o.items)) {
    units.set(item.productName, (units.get(item.productName) ?? 0) + item.quantity);
  }

  const lowStockCount = db.products
    .filter((p) => p.storeId === store.id)
    .flatMap((p) => toProductAdmin(db, p, store).variants)
    .filter((v) => v.active && v.lowStock).length;

  return {
    ordersToday,
    pendingConfirmation: orders.filter((o) => o.status === "new").length,
    salesWeekCents,
    ordersWeek: sold.length,
    averageTicketCents: sold.length > 0 ? Math.round(salesWeekCents / sold.length) : 0,
    lowStockCount,
    topProducts: [...units]
      .map(([name, count]) => ({ name, units: count }))
      .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
      .slice(0, TOP_PRODUCTS),
  };
}
