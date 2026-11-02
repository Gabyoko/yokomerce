// Contrato de datos: copia exacta de SPEC.md, sección 4. No cambiar sin actualizar la SPEC.
import type { ISODateTime } from "./common";
import type { VariantAdmin } from "./product";

export type StockMovementType = "reserve" | "release" | "sale" | "in" | "out" | "adjust";

export interface StockMovement {
  id: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;                    // positivo o negativo según el efecto
  reason: string | null;               // "venta_tienda", "feria", "merma", "regalo", "produccion", "correccion", "cancelacion"
  orderNumber: number | null;
  createdBy: string | null;            // null = automático
  createdAt: ISODateTime;
}

export interface StockAdjustmentInput {
  type: "in" | "out" | "adjust";       // adjust = fijar el total exacto
  quantity: number;
  reason: string;
}

/** POST /me/variants/:id/adjustments — el movimiento creado y la variante con su stock nuevo. */
export interface StockAdjustmentResult {
  movement: StockMovement;
  variant: VariantAdmin;
}
