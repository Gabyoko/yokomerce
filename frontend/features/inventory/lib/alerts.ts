import type { ProductAdmin, VariantAdmin } from "@/shared/types";

export type LowStockItem = { product: ProductAdmin; variant: VariantAdmin; available: number };

/**
 * Variantes activas con stock bajo o agotadas (las que piden reponer), las agotadas primero.
 * Los productos por encargo no cuentan si la tienda tiene la función activa.
 */
export function lowStockItems(products: ProductAdmin[], madeToOrderEnabled: boolean): LowStockItem[] {
  return products
    .filter((p) => !(p.madeToOrder && madeToOrderEnabled))
    .flatMap((product) =>
      product.variants
        .filter((v) => v.active && (v.lowStock || v.onHand - v.reserved <= 0))
        .map((variant) => ({ product, variant, available: Math.max(variant.onHand - variant.reserved, 0) })),
    )
    .sort((a, b) => a.available - b.available || a.product.name.localeCompare(b.product.name));
}

/** "Torta de chocolate · Grande" o solo el nombre si no tiene opciones. */
export const variantName = ({ product, variant }: Pick<LowStockItem, "product" | "variant">) =>
  variant.label ? `${product.name} · ${variant.label}` : product.name;
