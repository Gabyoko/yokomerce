import type { Product, Variant } from "@/shared/types";

import type { CartItem } from "./cart";

export type CartLine = {
  index: number;
  item: CartItem;
  product: Product;
  variant: Variant;
  lineTotalCents: number;
};

/**
 * Junta el carrito con los productos del catálogo para mostrar nombres y totales.
 * Es solo para mostrar: el total final lo calcula la API al crear el pedido.
 * Las líneas cuyo producto ya no está en el catálogo se omiten.
 */
export function resolveCartLines(items: CartItem[], products: Product[]): CartLine[] {
  const byVariant = new Map<string, { product: Product; variant: Variant }>();
  for (const product of products) {
    for (const variant of product.variants) byVariant.set(variant.id, { product, variant });
  }
  return items.flatMap((item, index) => {
    const found = byVariant.get(item.variantId);
    if (!found) return [];
    return [{ index, item, ...found, lineTotalCents: found.variant.priceCents * item.quantity }];
  });
}

export function linesTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
}
