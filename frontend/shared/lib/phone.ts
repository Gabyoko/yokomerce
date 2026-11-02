/**
 * Celulares peruanos: 9 dígitos que empiezan con 9. En WhatsApp van con el prefijo 51.
 * Aceptan lo que la gente escribe: espacios, guiones, paréntesis, "+51" o "51" adelante.
 */

const COUNTRY_CODE = "51";

/** Deja solo los 9 dígitos del celular, o null si no es un celular peruano válido. */
export function normalizePeruPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.length === 11 && digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length);

  return /^9\d{8}$/.test(digits) ? digits : null;
}

export function isValidPeruPhone(input: string): boolean {
  return normalizePeruPhone(input) !== null;
}

/** "987654321" o "51987654321" → "987 654 321". Si no es válido, devuelve el texto tal cual. */
export function formatPeruPhone(input: string): string {
  const phone = normalizePeruPhone(input);
  if (!phone) return input;
  return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
}

/** "987 654 321" → "51987654321" (para wa.me). Si no es válido, devuelve null. */
export function toWhatsAppNumber(input: string): string | null {
  const phone = normalizePeruPhone(input);
  return phone ? `${COUNTRY_CODE}${phone}` : null;
}
