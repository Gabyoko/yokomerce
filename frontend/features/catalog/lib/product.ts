import { formatSoles } from "@/shared/lib/money";
import type { Product, StoreFeatures, Variant } from "@/shared/types";

/** Máximo por línea del pedido (SPEC.md, sección 7). */
export const MAX_QUANTITY = 99;

const activeVariants = (product: Product) => product.variants.filter((v) => v.active);

/** Si una variante se puede pedir ahora. Los productos por encargo no llevan stock. */
export function isVariantAvailable(product: Product, variant: Variant): boolean {
  return variant.active && (product.madeToOrder || variant.available > 0);
}

export function isSoldOut(product: Product): boolean {
  return !activeVariants(product).some((v) => isVariantAvailable(product, v));
}

/** "S/ 45" si todas las variantes cuestan lo mismo; "Desde S/ 45" si no. */
export function priceLabel(product: Product): string {
  const prices = activeVariants(product).map((v) => v.priceCents);
  const min = prices.length > 0 ? Math.min(...prices) : product.priceFromCents;
  const varies = prices.some((price) => price !== min);
  const price = formatSoles(min, { trimZeroDecimals: true });
  return varies ? `Desde ${price}` : price;
}

export type StockBadge = { tone: "dark" | "danger" | "warning"; label: string };

/**
 * Badge de la tarjeta del catálogo:
 * "Por encargo", "Agotado", o "Quedan N" si todo lo que queda tiene stock bajo.
 */
export function stockBadge(product: Product): StockBadge | null {
  if (product.madeToOrder) return { tone: "dark", label: "Por encargo" };
  if (isSoldOut(product)) return { tone: "danger", label: "Agotado" };
  const withStock = activeVariants(product).filter((v) => v.available > 0);
  if (withStock.every((v) => v.lowStock)) {
    const left = withStock.reduce((sum, v) => sum + v.available, 0);
    return { tone: "warning", label: left === 1 ? "Queda 1" : `Quedan ${left}` };
  }
  return null;
}

/** Se puede agregar desde el catálogo sin abrir el producto: sin opciones ni campos extra. */
export function canQuickAdd(product: Product): boolean {
  return product.options.length === 0 && product.customFields.length === 0 && !isSoldOut(product);
}

/** Cuántas unidades se pueden pedir de una variante. */
export function maxQuantity(product: Product, variant: Variant): number {
  return product.madeToOrder ? MAX_QUANTITY : Math.min(Math.max(variant.available, 0), MAX_QUANTITY);
}

// ---------------------------------------------------------------------------
// Selector de opciones
// ---------------------------------------------------------------------------

/** Valor elegido por cada opción (en el orden de product.options); null = sin elegir. */
export type Selection = (string | null)[];

/** La variante que corresponde a la selección completa. */
export function findVariant(product: Product, selection: Selection): Variant | undefined {
  if (selection.some((id) => id === null)) return undefined;
  return product.variants.find((v) => v.optionValueIds.every((id, i) => id === selection[i]));
}

/**
 * Si un valor se puede elegir con lo que ya está elegido en las otras opciones:
 * existe una variante activa con stock que lo combine. Si no, se muestra tachado.
 */
export function isValueSelectable(product: Product, optionIndex: number, valueId: string, selection: Selection): boolean {
  return product.variants.some(
    (variant) =>
      isVariantAvailable(product, variant) &&
      variant.optionValueIds[optionIndex] === valueId &&
      variant.optionValueIds.every((id, i) => i === optionIndex || selection[i] == null || selection[i] === id),
  );
}

/** Selección inicial: la primera variante disponible (o nada elegido si todo está agotado). */
export function initialSelection(product: Product): Selection {
  const first = product.variants.find((v) => isVariantAvailable(product, v));
  return first ? [...first.optionValueIds] : product.options.map(() => null);
}

/** Elige un valor y suelta los de otras opciones que ya no combinen. */
export function selectValue(product: Product, selection: Selection, optionIndex: number, valueId: string): Selection {
  const next = [...selection];
  next[optionIndex] = valueId;
  return next.map((id, i) => (i === optionIndex || id === null || isValueSelectable(product, i, id, next) ? id : null));
}

/**
 * Aviso de anticipación del producto, según las funciones de la tienda:
 * "Pídelo con 1 día de anticipación." o "Se prepara por encargo." (null si no aplica).
 */
export function orderNotice(product: Product, features: StoreFeatures): string | null {
  const days = features.leadTimeDays;
  if ((product.madeToOrder || features.deliveryDate) && days > 0) {
    return `Pídelo con ${days} ${days === 1 ? "día" : "días"} de anticipación.`;
  }
  return product.madeToOrder ? "Se prepara por encargo." : null;
}
