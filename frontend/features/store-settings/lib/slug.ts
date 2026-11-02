/*
 * Link de la tienda: yokomerce.pe/<slug>. La API decide si está libre (GET /public/slugs/:slug);
 * esto solo ayuda a escribirlo bien y a avisar antes de preguntar.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/** SPEC.md, sección 8. */
export const RESERVED_SLUGS = ["panel", "registro", "ingresar", "api", "admin", "planes", "ayuda", "terminos", "privacidad", "dev"];

const stripAccents = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** "Dulces de Ana" → "dulcesdeana"; "Café Ñaña's" → "cafenanas". */
export function suggestSlug(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, SLUG_MAX);
}

/** Limpia lo que escribe el dueño en el campo del link: minúsculas, números y guiones. */
export function cleanSlugInput(input: string): string {
  return stripAccents(input)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX);
}

/** Por qué un link no sirve, antes de preguntarle a la API; null si el formato está bien. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `Usa al menos ${SLUG_MIN} letras o números.`;
  if (slug.startsWith("-") || slug.endsWith("-")) return "No puede empezar ni terminar con guion.";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Usa solo letras minúsculas, números y guiones.";
  if (RESERVED_SLUGS.includes(slug)) return "Este link está reservado. Prueba con otro.";
  return null;
}
