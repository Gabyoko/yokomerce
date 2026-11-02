"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { formatSoles } from "@/shared/lib/money";
import type { Product } from "@/shared/types";
import { buttonStyles, Card } from "@/shared/ui";

import { useCart } from "../hooks/useCart";
import { linesTotal, resolveCartLines } from "../lib/lines";

/** Resumen del carrito en la columna derecha (computadora). */
export function CartPanel({ slug, products }: { slug: string; products: Product[] }) {
  const { items, count } = useCart(slug);
  const lines = resolveCartLines(items, products);

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Tu pedido</h2>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ShoppingBag aria-hidden size={28} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">Tu carrito está vacío. Agrega productos para hacer tu pedido.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {lines.map(({ index, item, product, variant, lineTotalCents }) => (
              <li key={index} className="flex justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">
                    {item.quantity} × {product.name}
                  </span>
                  {variant.label && <span className="block text-ink-muted">{variant.label}</span>}
                  {Object.entries(item.customValues).map(([label, value]) => (
                    <span key={label} className="block truncate text-[13px] text-ink-muted">
                      {label}: {value}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 font-semibold">{formatSoles(lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-semibold">Subtotal</span>
            <span className="text-lg font-bold">{formatSoles(linesTotal(lines))}</span>
          </div>
          <Link href={`/${slug}/carrito`} className={buttonStyles({ size: "lg", fullWidth: true })}>
            Ver carrito
          </Link>
        </>
      )}
    </Card>
  );
}
