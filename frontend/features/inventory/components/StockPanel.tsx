"use client";

import { Lock, X } from "lucide-react";
import Link from "next/link";
import { Suspense, use, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { formatOrderTime } from "@/shared/lib/dates";
import type { ProductAdmin, StockMovement, VariantAdmin } from "@/shared/types";
import { Button, Card, Skeleton } from "@/shared/ui";

import { listStockMovements } from "../api";
import { movementLabel, signedQuantity } from "../lib/adjust";
import { StockAdjustButton } from "./StockAdjustButton";

type StockPanelProps = {
  product: ProductAdmin;
  variant: VariantAdmin;
  canSeeHistory: boolean;
  onClose: () => void;
};

const HISTORY_SHOWN = 10;

const loadHistory = (variantId: string) => listStockMovements(variantId).catch(() => null);

/**
 * Panel lateral del inventario (design/Inventario.dc.html): stock de una combinación,
 * entradas y salidas rápidas, e historial. Se monta con key={variant.id}.
 */
export function StockPanel({ product, variant, canSeeHistory, onClose }: StockPanelProps) {
  // El historial se pide al abrir el panel y otra vez después de cada ajuste
  const [history, setHistory] = useState<Promise<StockMovement[] | null> | null>(() =>
    canSeeHistory ? loadHistory(variant.id) : null,
  );
  const reload = () => setHistory(canSeeHistory ? loadHistory(variant.id) : null);
  const available = variant.onHand - variant.reserved;
  const name = variant.label ? `${product.name} · ${variant.label}` : product.name;

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-bold">{name}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {variant.lowStockThreshold !== null ? `Aviso cuando baje de ${variant.lowStockThreshold}` : "Sin aviso de stock bajo"}
          </p>
        </div>
        <Button iconOnly variant="ghost" aria-label="Cerrar panel" onClick={onClose}>
          <X />
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["En total", variant.onHand],
          ["Reservado", variant.reserved],
          ["Disponible", available],
        ].map(([label, value]) => (
          <div key={label} className="rounded-control bg-bg px-2 py-3">
            <dt className="text-[13px] text-ink-muted">{label}</dt>
            <dd className="font-display text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <StockAdjustButton product={product} variantId={variant.id} canSeeHistory={canSeeHistory} label="+ Entrada" initialType="in" onDone={reload} />
        <StockAdjustButton product={product} variantId={variant.id} canSeeHistory={canSeeHistory} label="− Salida" initialType="out" onDone={reload} />
        <StockAdjustButton
          product={product}
          variantId={variant.id}
          canSeeHistory={canSeeHistory}
          label="= Corregir el total"
          initialType="adjust"
          variant="ghost"
          className="col-span-2"
          onDone={reload}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-bold">Historial de movimientos</h3>
        {history === null ? (
          <Link href="/panel/plan" className="flex items-center gap-2 rounded-control border border-dashed border-border-strong p-3 text-sm text-ink-muted hover:text-primary">
            <Lock aria-hidden size={16} />
            El historial de movimientos es parte del plan Pro.
          </Link>
        ) : (
          <Suspense
            fallback={
              <div aria-busy="true" className="flex flex-col gap-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            }
          >
            <HistoryList promise={history} />
          </Suspense>
        )}
      </section>

      <Link href={`/panel/productos/${product.id}`} className="text-sm font-semibold text-primary hover:text-primary-hover">
        Editar producto
      </Link>
    </Card>
  );
}

function HistoryList({ promise }: { promise: Promise<StockMovement[] | null> }) {
  const movements = use(promise);
  if (movements === null) return <p className="text-sm text-ink-muted">No pudimos cargar el historial.</p>;
  if (movements.length === 0) return <p className="text-sm text-ink-muted">Todavía no hay movimientos.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {movements.slice(0, HISTORY_SHOWN).map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{movementLabel(m)}</span>
            <span className="block text-[13px] text-ink-muted">
              {formatOrderTime(m.createdAt)} · {m.createdBy ?? "automático"}
            </span>
          </span>
          <span className={cn("shrink-0 font-bold", m.quantity > 0 ? "text-whatsapp" : m.quantity < 0 ? "text-danger" : "text-ink-muted")}>
            {signedQuantity(m.quantity)}
          </span>
        </li>
      ))}
    </ul>
  );
}
