"use client";

import { PackageX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonStyles } from "@/shared/ui";

export default function ProductNotFound() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <PackageX aria-hidden size={36} className="text-ink-muted" />
      <h1 className="text-2xl font-bold">Este producto ya no está disponible</h1>
      <p className="max-w-sm text-ink-muted">Puede que la tienda lo haya retirado. Mira lo que tiene ahora en su catálogo.</p>
      <Link href={`/${slug}`} className={buttonStyles({ variant: "secondary" })}>
        Ver el catálogo
      </Link>
    </div>
  );
}
