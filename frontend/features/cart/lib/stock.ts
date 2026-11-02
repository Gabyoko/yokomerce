import type { Product } from "@/shared/types";

import { type CartItem, MAX_QUANTITY } from "./cart";

/** Una línea del carrito que tuvo que cambiar porque no alcanza el stock. `to = 0` → se quitó. */
export type CartAdjustment = { item: CartItem; from: number; to: number };

/**
 * Ajusta el carrito a lo que hay disponible. Si una variante está en varias líneas
 * (con distintos campos extra), el stock se reparte en orden. Las líneas que quedan en 0 se quitan.
 */
export function fitCartToStock(
  items: CartItem[],
  availableOf: (variantId: string) => number,
): { items: CartItem[]; adjustments: CartAdjustment[] } {
  const remaining = new Map<string, number>();
  const adjustments: CartAdjustment[] = [];
  const fitted: CartItem[] = [];

  for (const item of items) {
    const left = remaining.get(item.variantId) ?? Math.max(availableOf(item.variantId), 0);
    const quantity = Math.min(item.quantity, left);
    remaining.set(item.variantId, left - quantity);
    if (quantity < item.quantity) adjustments.push({ item, from: item.quantity, to: quantity });
    if (quantity > 0) fitted.push(quantity === item.quantity ? item : { ...item, quantity });
  }

  return { items: adjustments.length > 0 ? fitted : items, adjustments };
}

/**
 * Disponible por variante según el catálogo. Lo que no está en el catálogo (producto oculto
 * o borrado) o está inactivo cuenta como 0. Los productos por encargo no tienen límite de stock.
 */
export function catalogAvailability(products: Product[]): (variantId: string) => number {
  const available = new Map<string, number>();
  for (const product of products) {
    for (const variant of product.variants) {
      const value = !variant.active ? 0 : product.madeToOrder ? MAX_QUANTITY : variant.available;
      available.set(variant.id, value);
    }
  }
  return (variantId) => available.get(variantId) ?? 0;
}

/** Disponibles que devolvió la API en un `out_of_stock`. Las variantes que no vienen no tuvieron problema. */
export function reportedAvailability(items: { variantId: string; available: number }[]): (variantId: string) => number {
  const available = new Map(items.map((i) => [i.variantId, i.available]));
  return (variantId) => available.get(variantId) ?? Number.POSITIVE_INFINITY;
}
