"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonStyles } from "@/shared/ui";

export default function OrderNotFound() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <SearchX aria-hidden size={36} className="text-ink-muted" />
      <h1 className="text-2xl font-bold">No encontramos este pedido</h1>
      <p className="max-w-sm text-ink-muted">Revisa que el link esté completo. Si el problema sigue, escríbele a la tienda.</p>
      <Link href={`/${slug}`} className={buttonStyles({ variant: "secondary" })}>
        Ir a la tienda
      </Link>
    </div>
  );
}
