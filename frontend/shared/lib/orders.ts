import type { OrderStatus, PaymentMethod } from "@/shared/types";

/** 42 → "#0042". */
export function formatOrderNumber(number: number): string {
  return `#${String(number).padStart(4, "0")}`;
}

/** Nombres en la interfaz (SPEC.md, sección 7). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevo",
  paid: "Pagado",
  preparing: "Preparando",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Vencido",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  cash: "Efectivo",
  transfer: "Transferencia",
};
