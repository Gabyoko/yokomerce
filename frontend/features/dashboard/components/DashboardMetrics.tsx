import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { formatSoles } from "@/shared/lib/money";
import type { DashboardStats } from "@/shared/types";
import { Card } from "@/shared/ui";

type DashboardMetricsProps = {
  stats: DashboardStats;
  /** El plan incluye las métricas de la semana; si no, se muestran con candado. */
  fullStats: boolean;
};

function Metric({ label, value, detail, locked }: { label: string; value: ReactNode; detail: ReactNode; locked?: boolean }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold text-ink-muted">{label}</span>
      {locked ? (
        <Link href="/panel/plan" className="flex items-center gap-1.5 py-1 text-sm font-semibold text-ink-muted hover:text-primary">
          <Lock aria-hidden size={16} />
          Con Pro
        </Link>
      ) : (
        <span className="font-display text-2xl leading-tight font-bold">{value}</span>
      )}
      <span className="text-[13px] text-ink-muted">{detail}</span>
    </Card>
  );
}

/** Métricas del panel de pedidos (design/PanelPC.dc.html). */
export function DashboardMetrics({ stats, fullStats }: DashboardMetricsProps) {
  const pending = stats.pendingConfirmation;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Pedidos hoy" value={stats.ordersToday} detail={pending === 0 ? "Todo confirmado" : `${pending} por confirmar`} />
      <Metric
        label="Ventas de la semana"
        value={formatSoles(stats.salesWeekCents, { trimZeroDecimals: true })}
        detail={stats.ordersWeek === 1 ? "1 pedido pagado" : `${stats.ordersWeek} pedidos pagados`}
        locked={!fullStats}
      />
      <Metric
        label="Ticket promedio"
        value={formatSoles(stats.averageTicketCents, { trimZeroDecimals: true })}
        detail="Por pedido, últimos 7 días"
        locked={!fullStats}
      />
      <Metric
        label="Stock bajo"
        value={<span className={cn(stats.lowStockCount > 0 && "text-warning")}>{stats.lowStockCount}</span>}
        detail={
          <Link href="/panel/productos?filtro=low" className="font-semibold text-primary hover:text-primary-hover">
            Revisar inventario →
          </Link>
        }
      />
    </div>
  );
}
