import { addDays, daysBetween, formatDateShort, todayInLima, weekdayOf } from "@/shared/lib/dates";
import type { ISODate, Store } from "@/shared/types";

/** Cuántos días mostrar como opción y hasta dónde buscarlos. */
const MAX_OPTIONS = 7;
const SEARCH_DAYS = 30;

/**
 * Días que el cliente puede elegir para la entrega (SPEC.md, sección 7):
 * desde hoy + días de anticipación, solo días con horario de atención.
 * Si la tienda no usa fecha de entrega, no hay opciones.
 * Es solo para mostrar: la API vuelve a validar la fecha.
 */
export function deliveryDateOptions(
  store: Pick<Store, "features" | "businessHours">,
  now: Date = new Date(),
): ISODate[] {
  if (!store.features.deliveryDate) return [];
  const first = addDays(todayInLima(now), store.features.leadTimeDays);
  const dates: ISODate[] = [];
  for (let offset = 0; offset < SEARCH_DAYS && dates.length < MAX_OPTIONS; offset++) {
    const date = addDays(first, offset);
    if (store.businessHours[weekdayOf(date)] !== null) dates.push(date);
  }
  return dates;
}

/**
 * Texto de cada opción de fecha, en dos líneas: "Hoy" / "Mañana" / "Sáb" arriba y "31 oct" abajo.
 * `today` viene del servidor para que el texto no cambie al hidratar.
 */
export function dateChipLabel(date: ISODate, today: ISODate): { top: string; bottom: string } {
  const [weekday = "", ...rest] = formatDateShort(date).split(" ");
  const diff = daysBetween(today, date);
  return { top: diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : weekday, bottom: rest.join(" ") };
}
