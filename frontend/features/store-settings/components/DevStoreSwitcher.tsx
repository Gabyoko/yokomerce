"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { MOCK_STORE_COOKIE } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";

/** Tiendas de prueba de SPEC.md, sección 6. */
const TEST_STORES = [
  { slug: "dulcesdeana", name: "Dulces de Ana" },
  { slug: "tallernorte", name: "Taller Norte" },
  { slug: "fundalab", name: "Funda Lab" },
];

/**
 * Solo en desarrollo (fase F): cambia la tienda "mía" para probar cómo se comporta cada
 * combinación de funciones. Guarda la elección en la cookie mock_store.
 */
export function DevStoreSwitcher({ current, className }: { current: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (process.env.NODE_ENV === "production") return null;

  const options = TEST_STORES.some((s) => s.slug === current)
    ? TEST_STORES
    : [...TEST_STORES, { slug: current, name: current }];

  function change(slug: string) {
    document.cookie = `${MOCK_STORE_COOKIE}=${encodeURIComponent(slug)}; Path=/; SameSite=Lax; Max-Age=31536000`;
    startTransition(() => router.refresh());
  }

  return (
    <label className={cn("flex flex-col gap-1.5 rounded-control border border-dashed border-border-strong p-2.5 text-xs", className)}>
      <span className="font-semibold text-ink-muted">Tienda de prueba (solo desarrollo)</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="h-11 cursor-pointer rounded-field border border-border bg-surface px-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        {options.map((store) => (
          <option key={store.slug} value={store.slug}>
            {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}
