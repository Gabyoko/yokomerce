import { formatDateLong } from "@/shared/lib/dates";
import { formatSoles } from "@/shared/lib/money";
import { formatOrderNumber, PAYMENT_METHOD_LABELS } from "@/shared/lib/orders";
import { formatPeruPhone } from "@/shared/lib/phone";
import type { PublicOrder, Store } from "@/shared/types";

/** Monto de entrega: null = "a coordinar". */
function formatFee(cents: number | null): string {
  return cents === null ? "a coordinar" : formatSoles(cents);
}

/** Línea de costo de entrega. En recojo no hay costo, así que se omite. */
function feeLine(order: PublicOrder): string | null {
  const { type, zoneName, city } = order.fulfillment;
  if (type === "delivery") return `Delivery${zoneName ? ` (${zoneName})` : ""}: ${formatFee(order.deliveryFeeCents)}`;
  if (type === "shipping") return `Envío${city ? ` a ${city}` : ""}: ${formatFee(order.deliveryFeeCents)}`;
  return null;
}

/** "Av. Primavera 123 (Frente al parque)", con la ciudad en envíos; en recojo, "Recojo en tienda". */
function deliveryLine(order: PublicOrder): string | null {
  const { type, address, city, reference } = order.fulfillment;
  if (type === "pickup") return "Recojo en tienda";
  const place = [address, type === "shipping" ? city : null].filter(Boolean).join(", ");
  if (!place) return null;
  return reference ? `${place} (${reference})` : place;
}

/**
 * Mensaje de WhatsApp del pedido (SPEC.md, sección 7). Es solo formato: todos los datos
 * vienen del PublicOrder que devolvió la API. Las líneas sin dato se omiten.
 */
export function buildWhatsAppMessage(order: PublicOrder, store: Pick<Store, "name" | "slug">, siteUrl: string): string {
  const items = order.items.flatMap((item) => [
    `${item.quantity} × ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""} — ${formatSoles(item.lineTotalCents)}`,
    ...Object.entries(item.customValues)
      .filter(([, value]) => value.trim())
      .map(([label, value]) => `   ${label}: ${value}`),
  ]);

  const totals = [
    `Subtotal: ${formatSoles(order.subtotalCents)}`,
    feeLine(order),
    `Total: ${formatSoles(order.totalCents)}`,
  ];

  const delivery = deliveryLine(order);
  const details = [
    `Cliente: ${order.customer.name} · ${formatPeruPhone(order.customer.phone)}`,
    delivery ? `Entrega: ${delivery}` : null,
    order.deliveryDate ? `Fecha: ${formatDateLong(order.deliveryDate)}` : null,
    `Pago: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
  ];

  const link = `${siteUrl.replace(/\/+$/, "")}/${store.slug}/pedido/${order.publicToken}`;

  return [
    [`Nuevo pedido ${formatOrderNumber(order.number)} · ${store.name}`],
    items,
    totals,
    details,
    [`Ver pedido: ${link}`],
  ]
    .map((block) => block.filter((line): line is string => Boolean(line)).join("\n"))
    .join("\n\n");
}

/** Link que abre WhatsApp con el mensaje listo para enviar a la tienda. */
export function buildWhatsAppUrl(storeWhatsapp: string, message: string): string {
  return `https://wa.me/${storeWhatsapp}?text=${encodeURIComponent(message)}`;
}
