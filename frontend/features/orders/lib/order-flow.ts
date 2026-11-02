import { daysBetween, formatDateShort, formatTime, todayInLima } from "@/shared/lib/dates";
import { formatOrderNumber } from "@/shared/lib/orders";
import { formatPeruPhone, toWhatsAppNumber } from "@/shared/lib/phone";
import type { Order, OrderStatus } from "@/shared/types";

/*
 * Flujo del pedido en el panel (SPEC.md, sección 7):
 * new → paid → preparing → delivered; cancelled desde new, paid o preparing; expired es automático.
 */

export type OrderAction = "confirm" | "prepare" | "deliver";

export const NEXT_ACTION: Record<OrderStatus, { action: OrderAction; label: string } | null> = {
  new: { action: "confirm", label: "Confirmar pago" },
  paid: { action: "prepare", label: "Empezar a preparar" },
  preparing: { action: "deliver", label: "Marcar entregado" },
  delivered: null,
  cancelled: null,
  expired: null,
};

export const canCancel = (status: OrderStatus) => status === "new" || status === "paid" || status === "preparing";

/** Qué pasa con el stock al cancelar, para avisarlo antes de confirmar. */
export function cancelEffect(order: Pick<Order, "status" | "items">): string {
  const tracks = order.items.some((i) => i.tracksStock);
  if (!tracks) return "El pedido quedará como cancelado.";
  return order.status === "new"
    ? "Se libera el stock que estaba reservado y vuelve a tu catálogo."
    : "El pago ya estaba confirmado: los productos vuelven a tu stock. Si cobraste, coordina la devolución con el cliente.";
}

/** Pasos de la barra de progreso del detalle. */
export const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "new", label: "Nuevo" },
  { status: "paid", label: "Pagado" },
  { status: "preparing", label: "Preparando" },
  { status: "delivered", label: "Entregado" },
];

/** Paso actual (0 a 3); -1 si se canceló o venció. */
export const stepIndex = (status: OrderStatus) => ORDER_STEPS.findIndex((s) => s.status === status);

/** Pestañas del panel de pedidos: primero lo que hay que atender. */
export const ORDER_TABS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "new", label: "Nuevos" },
  { id: "paid", label: "Pagados" },
  { id: "preparing", label: "Preparando" },
  { id: "delivered", label: "Entregados" },
  { id: "all", label: "Todos" },
];

/** "2 × Torta de chocolate (Mediana), 1 × Alfajores x12" */
export function itemsSummary(order: Pick<Order, "items">): string {
  return order.items
    .map((i) => `${i.quantity} × ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""}`)
    .join(", ");
}

/** "Delivery · Santiago de Surco", "Recojo en tienda", "Envío · Arequipa" */
export function fulfillmentSummary(order: Pick<Order, "fulfillment">): string {
  const { type, zoneName, city } = order.fulfillment;
  if (type === "pickup") return "Recojo en tienda";
  if (type === "delivery") return zoneName ? `Delivery · ${zoneName}` : "Delivery";
  return city ? `Envío · ${city}` : "Envío";
}

/** "hoy, 10:28 a. m.", "ayer, 7:40 p. m." o "lun 26 oct, 9:00 a. m." (hora de Lima). */
export function receivedAt(createdAt: string, now: Date = new Date()): string {
  const date = todayInLima(new Date(createdAt));
  const diff = daysBetween(date, todayInLima(now));
  const day = diff === 0 ? "hoy" : diff === 1 ? "ayer" : formatDateShort(date).toLowerCase();
  return `${day}, ${formatTime(createdAt)}`;
}

/** Link para escribirle al cliente por WhatsApp con un saludo listo. */
export function customerWhatsAppUrl(order: Pick<Order, "customer" | "number">, storeName: string): string | null {
  const number = toWhatsAppNumber(order.customer.phone);
  if (!number) return null;
  const firstName = order.customer.name.trim().split(/\s+/)[0] ?? "";
  const text = `Hola ${firstName}, te escribo de ${storeName} por tu pedido ${formatOrderNumber(order.number)}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export const customerPhone = (order: Pick<Order, "customer">) => formatPeruPhone(order.customer.phone);

/** Busca por nombre, celular o número de pedido (sin importar tildes). */
export function matchesOrderSearch(order: Order, search: string): boolean {
  const normalize = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const query = normalize(search.trim());
  if (!query) return true;
  const digits = query.replace(/\D/g, "");
  if (/^#?\d+$/.test(query) && order.number === Number(digits)) return true;
  if (digits.length >= 3 && order.customer.phone.includes(digits)) return true;
  return normalize(order.customer.name).includes(query);
}
