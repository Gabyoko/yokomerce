import { addDays, formatClock, nowInLima, weekdayOf } from "@/shared/lib/dates";
import { formatSoles } from "@/shared/lib/money";
import type { Catalog, Store, Weekday } from "@/shared/types";

const DAY_NAMES: Record<Weekday, string> = {
  mon: "lunes",
  tue: "martes",
  wed: "miércoles",
  thu: "jueves",
  fri: "viernes",
  sat: "sábado",
  sun: "domingo",
};

export type OpenStatus = { open: boolean; label: string };

/**
 * Si la tienda está abierta ahora (hora de Lima) y el texto del badge:
 * "Abierto hasta 8 p. m.", "Cerrado · abre hoy 9 a. m.", "Cerrado · abre mañana 9 a. m.",
 * "Cerrado · abre el lunes 9 a. m." o "Cerrado" si no tiene horario.
 */
export function getOpenStatus(hours: Store["businessHours"], now: Date = new Date()): OpenStatus {
  const { date, weekday, time } = nowInLima(now);
  const today = hours[weekday];

  if (today && time >= today.open && time < today.close) {
    return { open: true, label: `Abierto hasta ${formatClock(today.close)}` };
  }
  if (today && time < today.open) {
    return { open: false, label: `Cerrado · abre hoy ${formatClock(today.open)}` };
  }
  for (let days = 1; days <= 7; days++) {
    const day = weekdayOf(addDays(date, days));
    const next = hours[day];
    if (!next) continue;
    const when = days === 1 ? "mañana" : `el ${DAY_NAMES[day]}`;
    return { open: false, label: `Cerrado · abre ${when} ${formatClock(next.open)}` };
  }
  return { open: false, label: "Cerrado" };
}

/** Formas de entrega activas, para los badges del encabezado: "Delivery desde S/ 8", "Recojo en tienda"... */
export function getDeliveryLabels(catalog: Pick<Catalog, "store" | "deliveryZones">): string[] {
  const { features } = catalog.store;
  const labels: string[] = [];
  if (features.deliveryZones && catalog.deliveryZones.length > 0) {
    const cheapest = Math.min(...catalog.deliveryZones.map((z) => z.priceCents));
    labels.push(cheapest === 0 ? "Delivery gratis" : `Delivery desde ${formatSoles(cheapest, { trimZeroDecimals: true })}`);
  }
  if (features.pickup) labels.push("Recojo en tienda");
  if (features.shipping) labels.push("Envíos a todo el Perú");
  return labels;
}

/** "Dulces de Ana" → "DA" para el logo cuando no hay imagen. */
export function storeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
