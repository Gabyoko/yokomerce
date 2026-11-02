"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import type { Product } from "@/shared/types";
import { Badge, Button, buttonStyles, Card, useToast } from "@/shared/ui";

import { useCart } from "@/features/cart";

import { canQuickAdd, isSoldOut, priceLabel, stockBadge } from "../lib/product";
import { ProductImage } from "./ProductImage";

type ProductCardProps = {
  slug: string;
  product: Product;
  inCart: boolean;
  priority?: boolean;
};

/** Tarjeta del catálogo (design/Main.dc.html). Sin opciones se agrega directo; con opciones abre el producto. */
export function ProductCard({ slug, product, inCart, priority }: ProductCardProps) {
  const { add } = useCart(slug);
  const { toast } = useToast();
  const href = `/${slug}/p/${product.id}`;
  const soldOut = isSoldOut(product);
  const badge = inCart && !soldOut ? { tone: "primary" as const, label: "En tu carrito" } : stockBadge(product);
  const subtitle = product.options.length > 0 ? product.options.map((o) => o.values.map((v) => v.value).join(", ")).join(" · ") : product.description;

  function quickAdd() {
    const variant = product.variants.find((v) => v.active);
    if (!variant) return;
    add({ variantId: variant.id, quantity: 1, customValues: {} });
    toast({ title: `Agregaste ${product.name}`, tone: "success" });
  }

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <Link
        href={href}
        className="flex flex-1 flex-col gap-2 rounded-[12px] text-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative overflow-hidden rounded-[12px]">
          <ProductImage src={product.images[0]} alt={product.name} muted={soldOut} priority={priority} />
          {badge && (
            <Badge tone={badge.tone} className="absolute top-2 left-2">
              {badge.label}
            </Badge>
          )}
        </div>
        <div className="px-1">
          <p className={`text-[15px] leading-tight font-semibold ${soldOut ? "text-ink-muted" : ""}`}>{product.name}</p>
          {subtitle && <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{subtitle}</p>}
        </div>
      </Link>

      <div className="flex min-h-11 items-center justify-between gap-2 px-1 pb-1">
        <span className={`text-base font-bold ${soldOut ? "text-ink-muted" : ""}`}>{priceLabel(product)}</span>
        {soldOut ? null : canQuickAdd(product) ? (
          <Button iconOnly aria-label={`Agregar ${product.name}`} onClick={quickAdd}>
            <Plus aria-hidden />
          </Button>
        ) : (
          <Link href={href} aria-label={`Elegir opciones de ${product.name}`} className={buttonStyles({ iconOnly: true })}>
            <ChevronRight aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  );
}
