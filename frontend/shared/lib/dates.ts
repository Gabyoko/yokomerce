import type { ISODate, ISODateTime, Weekday } from "@/shared/types";

/**
 * Fechas en la zona horaria de la tienda (America/Lima).
 *
 * - ISODate ("2026-10-31") es un día del calendario, sin hora: se calcula en UTC para que
 *   la zona del servidor o del navegador no lo mueva un día.
 * - ISODateTime ("2026-10-29T15:28:00Z") es un instante: se muestra convertido a Lima.
 *
 * Los textos se arman a mano (no con Intl) para que el servidor y el navegador den
 * exactamente el mismo resultado; Intl solo se usa para obtener los números en Lima.
 */

export const TIME_ZONE = "America/Lima";

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

const limaParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

type LimaDateTime = { date: ISODate; hour: number; minute: number };

/** Día y hora de un instante en Lima. */
function toLima(instant: Date): LimaDateTime {
  const parts = Object.fromEntries(limaParts.formatToParts(instant).map((p) => [p.type, p.value]));
  const pad = (value: string | undefined) => (value ?? "").padStart(2, "0");
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** "2026-10-31" → Date a medianoche UTC de ese día. Lanza error si la fecha no existe. */
function parseISODate(date: ISODate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day) return utc;
  }
  throw new RangeError(`Fecha inválida: "${date}" (se espera AAAA-MM-DD)`);
}

export function isValidISODate(date: string): boolean {
  try {
    parseISODate(date);
    return true;
  } catch {
    return false;
  }
}

/** Hoy en Lima, como "2026-10-31". */
export function todayInLima(now: Date = new Date()): ISODate {
  return toLima(now).date;
}

/** Suma (o resta) días a una fecha: addDays("2026-10-31", 1) → "2026-11-01". */
export function addDays(date: ISODate, days: number): ISODate {
  const utc = parseISODate(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Días entre dos fechas: daysBetween("2026-10-31", "2026-11-02") → 2. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

/** Día de la semana, con las claves de Store.businessHours: "2026-10-31" → "sat". */
export function weekdayOf(date: ISODate): Weekday {
  return WEEKDAYS[parseISODate(date).getUTCDay()] as Weekday;
}

/** "2026-10-31" → "sábado 31 de octubre" (mensaje de WhatsApp). */
export function formatDateLong(date: ISODate): string {
  const utc = parseISODate(date);
  return `${DAY_NAMES[utc.getUTCDay()]} ${utc.getUTCDate()} de ${MONTH_NAMES[utc.getUTCMonth()]}`;
}

/** "2026-10-31" → "Sáb 31 oct" (listas y tablas). */
export function formatDateShort(date: ISODate): string {
  const utc = parseISODate(date);
  return `${DAY_SHORT[utc.getUTCDay()]} ${utc.getUTCDate()} ${MONTH_SHORT[utc.getUTCMonth()]}`;
}

/** Fecha de entrega relativa a hoy en Lima: "Hoy", "Mañana" o "Sáb 31 oct". */
export function formatDeliveryDate(date: ISODate, now: Date = new Date()): string {
  const diff = daysBetween(todayInLima(now), date);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return formatDateShort(date);
}

/** Hora en Lima: "2026-10-29T14:40:00Z" → "9:40 a. m." */
export function formatTime(dateTime: ISODateTime): string {
  const { hour, minute } = toLima(new Date(dateTime));
  return formatHourMinute(hour, minute, { trimZeroMinutes: false });
}

function formatHourMinute(hour: number, minute: number, { trimZeroMinutes }: { trimZeroMinutes: boolean }): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "a. m." : "p. m.";
  const minutes = trimZeroMinutes && minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${hour12}${minutes} ${suffix}`;
}

/** Hora de un horario de atención: "20:00" → "8 p. m.", "09:30" → "9:30 a. m.". */
export function formatClock(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return formatHourMinute(hour ?? 0, minute ?? 0, { trimZeroMinutes: true });
}

/** Ahora en Lima: el día, el día de la semana y la hora como "HH:MM" (comparable con los horarios). */
export function nowInLima(now: Date = new Date()): { date: ISODate; weekday: Weekday; time: string } {
  const { date, hour, minute } = toLima(now);
  return { date, weekday: weekdayOf(date), time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

/** "Miércoles 28 de octubre" para encabezados del panel (hoy en Lima por defecto). */
export function formatTodayHeading(now: Date = new Date()): string {
  const text = formatDateLong(todayInLima(now));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Cuándo llegó un pedido, como en el panel:
 * "Hace un momento", "Hace 12 min", "9:40 a. m." (hoy), "Ayer" o "Lun 26 oct".
 */
export function formatOrderTime(createdAt: ISODateTime, now: Date = new Date()): string {
  const created = new Date(createdAt);
  const minutesAgo = Math.floor((now.getTime() - created.getTime()) / 60_000);

  if (minutesAgo < 1) return "Hace un momento";
  if (minutesAgo < 60) return `Hace ${minutesAgo} min`;

  const days = daysBetween(toLima(created).date, todayInLima(now));
  if (days === 0) return formatTime(createdAt);
  if (days === 1) return "Ayer";
  return formatDateShort(toLima(created).date);
}
