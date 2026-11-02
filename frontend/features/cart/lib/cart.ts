import { BRAND } from "@/shared/lib/brand";

/**
 * Carrito: solo guarda qué variante, cuántas y los campos extra (SPEC.md, sección 8).
 * Precios y disponibilidad se vuelven a pedir a la API.
 */

export type CartItem = {
  variantId: string;
  quantity: number;
  customValues: Record<string, string>;
};

export const MAX_QUANTITY = 99;

/** Una clave por tienda. */
export const cartStorageKey = (slug: string) => `${BRAND.storagePrefix}:carrito:${slug}`;

const clampQuantity = (quantity: number) => Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY);

/** Lee lo guardado e ignora lo que no tenga la forma correcta (datos viejos o editados a mano). */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry: unknown): CartItem[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const { variantId, quantity, customValues } = entry as Record<string, unknown>;
      if (typeof variantId !== "string" || typeof quantity !== "number") return [];
      const values =
        typeof customValues === "object" && customValues !== null
          ? Object.fromEntries(Object.entries(customValues).filter(([, v]) => typeof v === "string"))
          : {};
      const clamped = clampQuantity(quantity);
      return clamped > 0 ? [{ variantId, quantity: clamped, customValues: values as Record<string, string> }] : [];
    });
  } catch {
    return [];
  }
}

/** Dos líneas son la misma si son la misma variante con los mismos campos extra. */
function sameLine(a: CartItem, b: CartItem): boolean {
  if (a.variantId !== b.variantId) return false;
  const keysA = Object.keys(a.customValues).filter((k) => a.customValues[k]);
  const keysB = Object.keys(b.customValues).filter((k) => b.customValues[k]);
  return keysA.length === keysB.length && keysA.every((k) => a.customValues[k] === b.customValues[k]);
}

/** Agrega un ítem: si ya existe la misma línea, suma la cantidad (máximo 99). */
export function addToCart(items: CartItem[], item: CartItem): CartItem[] {
  const index = items.findIndex((existing) => sameLine(existing, item));
  if (index === -1) return [...items, { ...item, quantity: clampQuantity(item.quantity) }];
  return items.map((existing, i) =>
    i === index ? { ...existing, quantity: clampQuantity(existing.quantity + item.quantity) } : existing,
  );
}

/** Cambia la cantidad de una línea; con 0 la quita. */
export function setQuantity(items: CartItem[], index: number, quantity: number): CartItem[] {
  const clamped = clampQuantity(quantity);
  if (clamped === 0) return removeLine(items, index);
  return items.map((item, i) => (i === index ? { ...item, quantity: clamped } : item));
}

export function removeLine(items: CartItem[], index: number): CartItem[] {
  return items.filter((_, i) => i !== index);
}

/** Unidades en total (lo que muestra el contador del carrito). */
export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
