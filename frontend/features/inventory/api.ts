import { apiFetch } from "@/shared/api/client";
import type { StockAdjustmentInput, StockAdjustmentResult, StockMovement } from "@/shared/types";

/** POST /me/variants/:id/adjustments — ingreso, salida o ajuste del total. */
export function adjustStock(variantId: string, input: StockAdjustmentInput): Promise<StockAdjustmentResult> {
  return apiFetch<StockAdjustmentResult>(`/me/variants/${encodeURIComponent(variantId)}/adjustments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /me/variants/:id/movements — historial, más recientes primero (plan Pro). */
export function listStockMovements(variantId: string): Promise<StockMovement[]> {
  return apiFetch<StockMovement[]>(`/me/variants/${encodeURIComponent(variantId)}/movements`);
}
