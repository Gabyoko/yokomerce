import { apiFetch } from "@/shared/api/client";
import type { Order, OrderStatus } from "@/shared/types";

const orderPath = (id: string) => `/me/orders/${encodeURIComponent(id)}`;

/** GET /me/orders — más recientes primero; filtra por estado y busca por cliente, celular o número. */
export function listOrders(params: { status?: OrderStatus; search?: string } = {}): Promise<Order[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  const qs = query.toString();
  return apiFetch<Order[]>(`/me/orders${qs ? `?${qs}` : ""}`);
}

/** GET /me/orders/:id */
export function getOrder(id: string): Promise<Order> {
  return apiFetch<Order>(orderPath(id));
}

/** Nuevo → Pagado. Descuenta el stock reservado. */
export function confirmPayment(id: string): Promise<Order> {
  return apiFetch<Order>(`${orderPath(id)}/confirm-payment`, { method: "POST" });
}

/** Pagado → Preparando. */
export function startPreparing(id: string): Promise<Order> {
  return apiFetch<Order>(`${orderPath(id)}/start-preparing`, { method: "POST" });
}

/** Preparando → Entregado. */
export function markDelivered(id: string): Promise<Order> {
  return apiFetch<Order>(`${orderPath(id)}/deliver`, { method: "POST" });
}

/** Cancela: libera la reserva o devuelve el stock según el estado. */
export function cancelOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`${orderPath(id)}/cancel`, { method: "POST" });
}

/** Nota interna del negocio (el cliente no la ve). */
export function updateOrderNotes(id: string, notes: string | null): Promise<Order> {
  return apiFetch<Order>(orderPath(id), { method: "PATCH", body: JSON.stringify({ notes }) });
}
