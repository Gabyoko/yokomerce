import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { CartAdjustment } from "@/features/cart";
import type { Product } from "@/shared/types";

/** "Torta de chocolate (Grande)" o, si ya no está en el catálogo, "Un producto". */
function itemName(products: Product[], variantId: string): string {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return variant.label ? `${product.name} (${variant.label})` : product.name;
  }
  return "Un producto que agregaste";
}

export function adjustmentText(products: Product[], { item, to }: CartAdjustment): string {
  const name = itemName(products, item.variantId);
  if (to === 0) return `${name}: ya no está disponible.`;
  return `${name}: ${to === 1 ? "solo queda 1" : `solo quedan ${to}`}.`;
}

type StockNoticeProps = {
  title: string;
  adjustments: CartAdjustment[];
  products: Product[];
  /** Botón o texto debajo de la lista. */
  children?: ReactNode;
};

/** Aviso de productos que cambiaron (sin stock o con menos unidades). */
export function StockNotice({ title, adjustments, products, children }: StockNoticeProps) {
  return (
    <div role="alert" className="flex gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-sm text-ink">
      <TriangleAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-warning" />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-bold">{title}</p>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {adjustments.map((adjustment, n) => (
            <li key={n}>{adjustmentText(products, adjustment)}</li>
          ))}
        </ul>
        {children}
      </div>
    </div>
  );
}
