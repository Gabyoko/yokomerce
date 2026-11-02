import type { Cents } from "@/shared/types";

type FormatSolesOptions = {
  /** Oculta ".00" en montos exactos: "S/ 45" en vez de "S/ 45.00" (tarjetas del catálogo). */
  trimZeroDecimals?: boolean;
};

/**
 * Céntimos → texto en soles: 124000 → "S/ 1,240.00".
 * Se arma a mano (no con Intl) para que el servidor y el navegador den exactamente el mismo texto.
 */
export function formatSoles(cents: Cents, { trimZeroDecimals = false }: FormatSolesOptions = {}): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const soles = Math.floor(abs / 100);
  const centimos = abs % 100;

  const integer = String(soles).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = trimZeroDecimals && centimos === 0 ? "" : `.${String(centimos).padStart(2, "0")}`;

  return `${sign}S/ ${integer}${decimals}`;
}

/**
 * Lo que escribe el dueño en un campo de precio → céntimos.
 * Acepta "8", "8.5", "8.50", "8,50", "S/ 1,240.00". Devuelve null si no es un monto válido.
 */
export function parseSolesInput(input: string): Cents | null {
  let value = input.replace(/s\/|\s/gi, "");
  if (!value) return null;
  // "1,240.00" → miles con coma; "8,50" → coma decimal
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) value = value.replace(/,/g, "");
  else value = value.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [soles = "0", decimals = ""] = value.split(".");
  return Number(soles) * 100 + Number(decimals.padEnd(2, "0"));
}

/** Céntimos → texto para un campo de precio: 800 → "8", 850 → "8.50". */
export function centsToInput(cents: Cents): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
