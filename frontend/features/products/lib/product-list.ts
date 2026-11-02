import { formatSoles } from "@/shared/lib/money";
import type { ProductAdmin } from "@/shared/types";

export type StockStatus = "available" | "low" | "out" | "madeToOrder";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  available: "Disponible",
  low: "Stock bajo",
  out: "Agotado",
  madeToOrder: "Por encargo",
};

export type ProductSummary = {
  status: StockStatus;
  /** Unidades disponibles (activas); null si es por encargo. */
  available: number | null;
  reserved: number;
  priceLabel: string;
  /** "6 combinaciones" o "" si no tiene opciones. */
  variantsLabel: string;
};

/**
 * Estado de un producto en la lista del panel. `madeToOrderEnabled`: si la tienda tiene la función
 * apagada, el producto se trata como uno normal (SPEC.md, sección 7).
 */
export function summarizeProduct(product: ProductAdmin, madeToOrderEnabled: boolean): ProductSummary {
  const active = product.variants.filter((v) => v.active);
  const prices = active.map((v) => v.priceCents);
  const min = prices.length > 0 ? Math.min(...prices) : product.priceFromCents;
  const priceLabel = prices.some((p) => p !== min) ? `Desde ${formatSoles(min)}` : formatSoles(min);
  const count = product.variants.length;
  const variantsLabel = product.options.length === 0 ? "" : count === 1 ? "1 combinación" : `${count} combinaciones`;
  const reserved = active.reduce((sum, v) => sum + v.reserved, 0);

  if (product.madeToOrder && madeToOrderEnabled) {
    return { status: "madeToOrder", available: null, reserved, priceLabel, variantsLabel };
  }
  const available = active.reduce((sum, v) => sum + Math.max(v.onHand - v.reserved, 0), 0);
  const withStock = active.filter((v) => v.onHand - v.reserved > 0);
  const status: StockStatus =
    available === 0 ? "out" : active.some((v) => v.lowStock) || withStock.length < active.length ? "low" : "available";
  return { status, available, reserved, priceLabel, variantsLabel };
}

export type ProductFilter = "all" | StockStatus | "hidden";

export const PRODUCT_FILTERS: { id: ProductFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "low", label: "Stock bajo" },
  { id: "out", label: "Agotados" },
  { id: "madeToOrder", label: "Por encargo" },
  { id: "hidden", label: "Ocultos" },
];

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function matchesFilter(
  product: ProductAdmin,
  summary: ProductSummary,
  { filter, search, categoryId }: { filter: ProductFilter; search: string; categoryId: string | null },
): boolean {
  if (categoryId !== null && product.categoryId !== categoryId) return false;
  if (search.trim() && !normalize(product.name).includes(normalize(search.trim()))) return false;
  if (filter === "all") return true;
  if (filter === "hidden") return !product.visible;
  return summary.status === filter;
}
