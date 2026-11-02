import Link from "next/link";

import { lowStockItems, StockAdjustButton, variantName } from "@/features/inventory";
import { ProLock } from "@/features/plans";
import type { DashboardStats, ProductAdmin } from "@/shared/types";
import { Card } from "@/shared/ui";

type DashboardAsideProps = {
  stats: DashboardStats;
  products: ProductAdmin[];
  madeToOrderEnabled: boolean;
  fullStats: boolean;
  canSeeHistory: boolean;
};

const MAX_ALERTS = 5;

/** Columna derecha del panel: stock bajo para reponer y lo más vendido. */
export function DashboardAside({ stats, products, madeToOrderEnabled, fullStats, canSeeHistory }: DashboardAsideProps) {
  const alerts = lowStockItems(products, madeToOrderEnabled);
  const top = stats.topProducts;
  const maxUnits = Math.max(1, ...top.map((p) => p.units));

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Stock bajo</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-ink-muted">Todo tu stock está bien.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {alerts.slice(0, MAX_ALERTS).map((item) => (
              <li key={item.variant.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold">{variantName(item)}</span>
                  <span className={item.available === 0 ? "text-danger" : "text-ink-muted"}>
                    {item.available === 0
                      ? "Agotado"
                      : `${item.available} ${item.available === 1 ? "disponible" : "disponibles"}`}
                    {item.variant.lowStockThreshold !== null && ` · mínimo ${item.variant.lowStockThreshold}`}
                  </span>
                </span>
                <StockAdjustButton
                  product={item.product}
                  variantId={item.variant.id}
                  canSeeHistory={canSeeHistory}
                  label="Reponer"
                  variant="ghost"
                  className="text-primary"
                />
              </li>
            ))}
          </ul>
        )}
        {alerts.length > MAX_ALERTS && (
          <Link href="/panel/productos?filtro=low" className="text-sm font-semibold text-primary hover:text-primary-hover">
            Ver los {alerts.length}
          </Link>
        )}
      </Card>

      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="text-base font-bold">Lo más vendido</h2>
        {!fullStats ? (
          <ProLock>Mira qué se vende más con el plan Pro.</ProLock>
        ) : top.length === 0 ? (
          <p className="text-sm text-ink-muted">Aún no hay ventas confirmadas esta semana.</p>
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              {top.map((p) => (
                <li key={p.name} className="flex flex-col gap-1 text-sm">
                  <span className="flex justify-between gap-3">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 font-bold">{p.units}</span>
                  </span>
                  <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-bg">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(p.units / maxUnits) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-[13px] text-ink-muted">Unidades vendidas en los últimos 7 días.</p>
          </>
        )}
      </Card>
    </div>
  );
}
