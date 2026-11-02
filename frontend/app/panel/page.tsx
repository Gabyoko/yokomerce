import type { Metadata } from "next";

import { DashboardAside, DashboardMetrics, getDashboardStats } from "@/features/dashboard";
import { loadMyOrders, OrdersBoard } from "@/features/orders";
import { canUse } from "@/features/plans";
import { loadMyProducts } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { pageTitle } from "@/shared/lib/brand";
import { formatTodayHeading } from "@/shared/lib/dates";

export const metadata: Metadata = { title: pageTitle("Pedidos") };

export default async function OrdersPage() {
  const [store, orders, stats, products] = await Promise.all([
    loadMyStore(),
    loadMyOrders(),
    getDashboardStats(),
    loadMyProducts(),
  ]);
  const now = new Date();
  const fullStats = canUse(store, "fullStats");
  return (
    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <OrdersBoard
        key={store.id}
        orders={orders}
        store={{ name: store.name, slug: store.slug }}
        lowStockCount={stats.lowStockCount}
        now={now.toISOString()}
        todayHeading={formatTodayHeading(now)}
        metrics={<DashboardMetrics stats={stats} fullStats={fullStats} />}
      />
      <aside className="xl:sticky xl:top-7">
        <DashboardAside
          stats={stats}
          products={products}
          madeToOrderEnabled={store.features.madeToOrder}
          fullStats={fullStats}
          canSeeHistory={canUse(store, "stockHistory")}
        />
      </aside>
    </div>
  );
}
