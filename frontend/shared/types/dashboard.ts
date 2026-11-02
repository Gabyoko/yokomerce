// Contrato de datos: copia exacta de SPEC.md, sección 4. No cambiar sin actualizar la SPEC.
import type { Cents } from "./common";

export interface DashboardStats {
  ordersToday: number;
  pendingConfirmation: number;
  salesWeekCents: Cents;
  ordersWeek: number;
  averageTicketCents: Cents;
  lowStockCount: number;
  topProducts: { name: string; units: number }[];
}
