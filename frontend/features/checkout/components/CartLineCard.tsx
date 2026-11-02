"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import type { CartLine } from "@/features/cart";
import { maxQuantity, ProductImage } from "@/features/catalog";
import { formatSoles } from "@/shared/lib/money";
import { Badge } from "@/shared/ui";

type CartLineCardProps = {
  slug: string;
  line: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
};

/** Detalle de la variante y campos extra: "Mediana · Dedicatoria: “Feliz cumpleaños”". */
export function lineDetails({ item, variant }: Pick<CartLine, "item" | "variant">): string {
  return [variant.label, ...Object.entries(item.customValues).map(([label, value]) => `${label}: “${value}”`)]
    .filter(Boolean)
    .join(" · ");
}

const stepButton =
  "flex size-11 cursor-pointer items-center justify-center rounded-field text-ink disabled:cursor-not-allowed disabled:text-border-strong focus-visible:outline-2 focus-visible:outline-primary";

/** Una línea del carrito con foto, detalle, cantidad y aviso de stock bajo (design/Carrito.dc.html). */
export function CartLineCard({ slug, line, onQuantityChange, onRemove }: CartLineCardProps) {
  const { item, product, variant, lineTotalCents } = line;
  const max = maxQuantity(product, variant);
  const details = lineDetails(line);
  const lowStock = !product.madeToOrder && variant.lowStock && variant.available > 0;

  return (
    <div className="flex gap-3 p-3.5">
      <Link
        href={`/${slug}/p/${product.id}`}
        tabIndex={-1}
        aria-hidden
        className="size-16 shrink-0 overflow-hidden rounded-control"
      >
        <ProductImage src={product.images[0]} alt="" iconSize={20} className="size-16" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex justify-between gap-2 text-[15px] font-bold">
          <Link href={`/${slug}/p/${product.id}`} className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
            {product.name}
          </Link>
          <span className="shrink-0">{formatSoles(lineTotalCents)}</span>
        </div>
        {details && <p className="text-[13px] leading-snug break-words text-ink-muted">{details}</p>}
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center rounded-field border border-border" role="group" aria-label={`Cantidad de ${product.name}`}>
            {item.quantity <= 1 ? (
              <button type="button" aria-label={`Quitar ${product.name} del carrito`} className={stepButton} onClick={onRemove}>
                <Trash2 aria-hidden size={16} />
              </button>
            ) : (
              <button type="button" aria-label="Quitar uno" className={stepButton} onClick={() => onQuantityChange(item.quantity - 1)}>
                <Minus aria-hidden size={16} />
              </button>
            )}
            <span aria-live="polite" className="w-6 text-center text-[15px] font-bold">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label="Agregar uno"
              className={stepButton}
              disabled={item.quantity >= max}
              onClick={() => onQuantityChange(item.quantity + 1)}
            >
              <Plus aria-hidden size={16} />
            </button>
          </div>
          {lowStock && (
            <Badge tone="warning">{variant.available === 1 ? "Queda 1" : `Quedan ${variant.available}`}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
