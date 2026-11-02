import Link from "next/link";
import type { ReactNode } from "react";

import { BRAND } from "@/shared/lib/brand";

import { PanelNav } from "./PanelNav";

export type PanelShellStore = {
  name: string;
  logoUrl?: string | null;
  /** Link público sin protocolo, ej. "yokomerce.pe/mitienda". */
  publicUrl: string;
};

export type PanelShellPlan = {
  name: string;
  productsUsed: number;
  /** null = sin límite (Pro). */
  productsLimit: number | null;
};

type PanelShellProps = {
  /** Tarjeta de la tienda arriba del menú lateral (usa PanelStoreCard). Puede cargar con Suspense. */
  storeCard: ReactNode;
  /** Tarjeta del plan abajo del menú lateral (usa PlanCard). */
  planCard: ReactNode;
  /** Algo extra al final del menú lateral (ej. selector de tiendas de prueba). */
  sidebarFooter?: ReactNode;
  /** Contador de pedidos nuevos para el menú lateral y el inferior. */
  ordersBadge?: { sidebar: ReactNode; bottom: ReactNode };
  children: ReactNode;
};

/** Iniciales para el avatar: "Dulces de Ana" → "DA" (salta palabras cortas como "de"). */
function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const main = words.filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(word));
  return (main.length > 0 ? main : words)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

/**
 * Layout del panel del negocio.
 * Celular: contenido y menú inferior fijo. Computadora (lg): menú lateral a la izquierda.
 */
export function PanelShell({ storeCard, planCard, sidebarFooter, ordersBadge, children }: PanelShellProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link
          href="/panel"
          className="px-2 font-display text-2xl font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          {BRAND.logo}<span className="text-primary">.</span>
        </Link>

        {storeCard}

        <PanelNav variant="sidebar" ordersBadge={ordersBadge?.sidebar} />

        <div className="mt-auto flex flex-col gap-3">
          {planCard}
          {sidebarFooter}
        </div>
      </aside>

      {/* pb-28: espacio para que el menú inferior no tape el contenido en celular */}
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10">{children}</main>

      <div className="lg:hidden">
        <PanelNav variant="bottom" ordersBadge={ordersBadge?.bottom} />
      </div>
    </div>
  );
}

/** Nombre, logo y link de la tienda en el menú lateral. */
export function PanelStoreCard({ store }: { store: PanelShellStore }) {
  return (
    <div className="flex items-center gap-2.5 rounded-control bg-bg p-2.5">
      {store.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.logoUrl} alt="" className="size-10 shrink-0 rounded-field object-cover" />
      ) : (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-field bg-primary text-sm font-bold text-white"
        >
          {initials(store.name)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{store.name}</span>
        <span className="block truncate text-xs text-ink-muted">{store.publicUrl}</span>
      </span>
    </div>
  );
}

/** Mientras cargan la tienda o el plan. */
export function PanelCardSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-border/70 ${className ?? "h-15"}`} />;
}

export function PlanCard({ plan }: { plan: PanelShellPlan }) {
  const percent =
    plan.productsLimit && plan.productsLimit > 0
      ? Math.min(100, Math.round((plan.productsUsed / plan.productsLimit) * 100))
      : null;

  return (
    <div className="flex flex-col gap-2 rounded-control border border-border p-3.5">
      <span className="text-[13px] font-bold">Plan {plan.name}</span>
      {plan.productsLimit !== null && percent !== null ? (
        <>
          <span className="text-xs text-ink-muted">
            {plan.productsUsed} de {plan.productsLimit} productos
          </span>
          <div
            role="progressbar"
            aria-label="Productos usados"
            aria-valuemin={0}
            aria-valuemax={plan.productsLimit}
            aria-valuenow={plan.productsUsed}
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <Link
            href="/panel/plan"
            className="text-[13px] font-bold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
          >
            Mejorar a Pro
          </Link>
        </>
      ) : (
        <Link
          href="/panel/plan"
          className="text-[13px] font-bold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
        >
          Ver mi plan
        </Link>
      )}
    </div>
  );
}
