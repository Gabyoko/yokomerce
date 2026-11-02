import { daysBetween, formatDateShort, formatTime, todayInLima } from "@/shared/lib/dates";
import type { ISODateTime, PublicOrder } from "@/shared/types";

/**
 * Hasta cuándo se separan los productos: "hoy a las 3:28 p. m.", "mañana a las 9:00 a. m."
 * o "el sáb 31 oct a las 9:00 a. m." (hora de Lima).
 */
export function reservationDeadline(reservedUntil: ISODateTime, now: Date = new Date()): string {
  const date = todayInLima(new Date(reservedUntil));
  const diff = daysBetween(todayInLima(now), date);
  const day = diff === 0 ? "hoy" : diff === 1 ? "mañana" : `el ${formatDateShort(date).toLowerCase()}`;
  return `${day} a las ${formatTime(reservedUntil)}`;
}

/** Si el pedido separa stock (algún producto lo controla). Los pedidos solo por encargo no reservan. */
export const reservesStock = (order: Pick<PublicOrder, "items">) => order.items.some((item) => item.tracksStock);

/** Título y texto de la página del pedido según su estado. */
export function orderStatusCopy(status: PublicOrder["status"], storeName: string): { title: string; text: string } {
  switch (status) {
    case "new":
      return {
        title: "Tu pedido está listo",
        text: `Solo falta enviarlo. ${storeName} te confirmará el pago y la hora de entrega por WhatsApp.`,
      };
    case "paid":
      return { title: "Pago confirmado", text: `${storeName} ya confirmó tu pago y pronto preparará tu pedido.` };
    case "preparing":
      return { title: "Están preparando tu pedido", text: `${storeName} ya está preparando tu pedido.` };
    case "delivered":
      return { title: "Pedido entregado", text: `Gracias por comprar en ${storeName}.` };
    case "cancelled":
      return { title: "Pedido cancelado", text: `${storeName} canceló este pedido. Si tienes dudas, escríbele por WhatsApp.` };
    case "expired":
      return {
        title: "Este pedido venció",
        text: "La reserva terminó sin que se confirmara el pago. Puedes hacer un nuevo pedido cuando quieras.",
      };
  }
}
