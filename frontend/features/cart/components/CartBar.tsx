"use client";

import Link from "next/link";

import { formatSoles } from "@/shared/lib/money";
import type { Product } from "@/shared/types";

import { useCart } from "../hooks/useCart";
import { linesTotal, resolveCartLines } from "../lib/lines";

/** Barra fija abajo en el celular: "3 · Ver carrito · S/ 108.00". Solo aparece si hay algo en el carrito. */
export function CartBar({ slug, products }: { slug: string; products: Product[] }) {
  const { items, count } = useCart(slug);
  if (count === 0) return null;
  const total = linesTotal(resolveCartLines(items, products));

  return (
    <div className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 lg:hidden">
      <Link
        href={`/${slug}/carrito`}
        className="flex h-15 items-center justify-between rounded-[18px] bg-ink px-4.5 text-white shadow-lg transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[13px] font-bold">{count}</span>
          <span className="text-[15px] font-semibold">Ver carrito</span>
        </span>
        <span className="text-base font-bold">{formatSoles(total)}</span>
      </Link>
    </div>
  );
}
