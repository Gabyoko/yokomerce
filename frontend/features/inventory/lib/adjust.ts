import { formatOrderNumber } from "@/shared/lib/orders";
import type { StockAdjustmentInput, StockMovement, StockMovementType } from "@/shared/types";

/*
 * Ajuste manual de stock (SPEC.md, sección 7): `in` suma, `out` resta, `adjust` fija el total.
 * Nunca puede dejar el total por debajo de lo reservado. Esto solo es para la vista previa:
 * la API decide.
 */

export type AdjustType = StockAdjustmentInput["type"];

export const ADJUST_TYPES: { type: AdjustType; label: string; hint: string }[] = [
  { type: "in", label: "+ Entrada", hint: "Llegaron o hiciste más" },
  { type: "out", label: "− Salida", hint: "Se fueron sin pedido por la web" },
  { type: "adjust", label: "= Corregir", hint: "Contaste y el total es otro" },
];

/** Motivos guardados como código (SPEC.md, sección 4) con su texto en la interfaz. */
export const REASON_LABELS: Record<string, string> = {
  produccion: "Producción",
  compra: "Compra a proveedor",
  devolucion: "Devolución",
  venta_tienda: "Venta en tienda",
  feria: "Feria",
  merma: "Merma",
  regalo: "Regalo",
  correccion: "Corrección de conteo",
  cancelacion: "Cancelación",
};

export const REASONS_BY_TYPE: Record<AdjustType, string[]> = {
  in: ["produccion", "compra", "devolucion"],
  out: ["venta_tienda", "feria", "merma", "regalo"],
  adjust: ["correccion"],
};

export const reasonLabel = (reason: string | null) => (reason ? (REASON_LABELS[reason] ?? reason) : null);

export type StockNow = { onHand: number; reserved: number };

export type AdjustPreview =
  | { ok: true; onHand: number; available: number }
  | { ok: false; message: string };

/** Cómo queda el stock después del ajuste, o por qué no se puede. */
export function previewAdjustment({ onHand, reserved }: StockNow, type: AdjustType, quantity: number): AdjustPreview {
  const available = onHand - reserved;
  if (!Number.isInteger(quantity) || quantity < (type === "adjust" ? 0 : 1)) {
    return { ok: false, message: type === "adjust" ? "Escribe el total exacto (0 o más)." : "Escribe una cantidad mayor a 0." };
  }
  if (type === "out" && quantity > available) {
    return {
      ok: false,
      message: available === 0 ? "No hay unidades disponibles para sacar." : `Solo puedes sacar ${available}: el resto está reservado en pedidos.`,
    };
  }
  if (type === "adjust" && quantity < reserved) {
    return { ok: false, message: `Hay ${reserved} reservados en pedidos nuevos: el total no puede ser menor.` };
  }
  const next = type === "in" ? onHand + quantity : type === "out" ? onHand - quantity : quantity;
  return { ok: true, onHand: next, available: next - reserved };
}

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  reserve: "Reserva",
  release: "Reserva liberada",
  sale: "Venta",
  in: "Entrada",
  out: "Salida",
  adjust: "Corrección",
};

/** "Reserva · pedido #0042", "Entrada · Producción", "Salida · Venta en tienda". */
export function movementLabel(movement: Pick<StockMovement, "type" | "reason" | "orderNumber">): string {
  const detail = movement.orderNumber !== null ? `pedido ${formatOrderNumber(movement.orderNumber)}` : reasonLabel(movement.reason);
  return detail ? `${MOVEMENT_LABELS[movement.type]} · ${detail}` : MOVEMENT_LABELS[movement.type];
}

/** "+12", "−3", "0" */
export const signedQuantity = (quantity: number) => (quantity > 0 ? `+${quantity}` : quantity < 0 ? `−${-quantity}` : "0");
