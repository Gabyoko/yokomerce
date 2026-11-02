import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { formatSoles } from "@/shared/lib/money";
import type { Cents } from "@/shared/types";
import { buttonStyles } from "@/shared/ui";

import type { FeeLine } from "../lib/fulfillment";

/** "1 producto", "3 productos" (unidades). */
export const productCount = (count: number) =>
  count === 1 ? "1 producto" : `${count} productos`;

type TotalsProps = {
  subtotalCents: Cents;
  count: number;
  fee: FeeLine | null;
  /** Mostrar la fila de total (en el checkout). */
  showTotal?: boolean;
};

function feeText(fee: FeeLine): string {
  if (fee.amount === undefined) return fee.hint ?? "Por elegir";
  if (fee.amount === null) return "A coordinar";
  return fee.amount === 0 ? "Gratis" : formatSoles(fee.amount);
}

/** Total de referencia: el total final lo calcula la API al crear el pedido. */
export function referenceTotal(
  subtotalCents: Cents,
  fee: FeeLine | null,
): Cents {
  return subtotalCents + (fee?.amount ?? 0);
}

/** Subtotal, costo de entrega y total (design/Carrito y Datos). */
export function Totals({
  subtotalCents,
  count,
  fee,
  showTotal = false,
}: TotalsProps) {
  const pending = fee?.amount === undefined || fee.amount === null;
  return (
    <div className="flex flex-col gap-2.5 text-[15px]">
      <dl className="flex flex-col gap-2.5">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Subtotal ({productCount(count)})</dt>
          <dd className="font-semibold">{formatSoles(subtotalCents)}</dd>
        </div>
        {fee && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{fee.label}</dt>
            <dd
              className={
                fee.amount === undefined ? "text-ink-muted" : "font-semibold"
              }
            >
              {feeText(fee)}
            </dd>
          </div>
        )}
        {showTotal && (
          <>
            <div aria-hidden className="h-px bg-border" />
            <div className="flex justify-between gap-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatSoles(referenceTotal(subtotalCents, fee))}</dd>
            </div>
          </>
        )}
      </dl>
      {showTotal && fee && pending && (
        <p className="text-[13px] text-ink-muted">
          {fee.amount === null
            ? "El costo de envío lo coordinas con la tienda."
            : "Falta sumar el delivery."}
        </p>
      )}
    </div>
  );
}

/** Carrito vacío, con enlace al catálogo. */
export function EmptyCart({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <ShoppingBag aria-hidden size={28} />
      </span>
      <h2 className="font-display text-xl font-bold">Tu carrito está vacío</h2>
      <p className="max-w-xs text-[15px] text-ink-muted">
        Agrega productos del catálogo para armar tu pedido.
      </p>
      <Link
        href={`/${slug}`}
        className={buttonStyles({ size: "lg", className: "mt-2" })}
      >
        Ver productos
      </Link>
    </div>
  );
}
