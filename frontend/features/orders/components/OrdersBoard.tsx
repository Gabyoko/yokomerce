"use client";

import { ChevronRight, ReceiptText, Search, Share2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { formatDeliveryDate, formatOrderTime } from "@/shared/lib/dates";
import { formatSoles } from "@/shared/lib/money";
import { formatOrderNumber, PAYMENT_METHOD_LABELS } from "@/shared/lib/orders";
import { storeUrl, storeUrlLabel } from "@/shared/lib/site";
import type { Order, OrderStatus } from "@/shared/types";
import { Button, buttonStyles, Card, Input, useToast } from "@/shared/ui";

import { useOrderAction } from "../hooks/useOrderAction";
import {
  customerPhone,
  fulfillmentSummary,
  itemsSummary,
  matchesOrderSearch,
  NEXT_ACTION,
  ORDER_TABS,
} from "../lib/order-flow";
import { OrderStatusBadge } from "./OrderStatusBadge";

type OrdersBoardProps = {
  orders: Order[];
  store: { name: string; slug: string };
  lowStockCount: number;
  /** Fecha y hora del servidor: los textos "Hace 12 min" no cambian al hidratar. */
  now: string;
  todayHeading: string;
  /** Métricas debajo del encabezado (las arma la página con features/dashboard). */
  metrics?: ReactNode;
};

/** Cada cuánto se buscan pedidos nuevos mientras el panel está abierto. */
const REFRESH_MS = 30_000;

type Tab = OrderStatus | "all";

/** Panel de pedidos (design/Pedidos.dc.html y PanelPC.dc.html). */
export function OrdersBoard({ orders, store, lowStockCount, now, todayHeading, metrics }: OrdersBoardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { run, pendingId } = useOrderAction();
  const [tab, setTab] = useState<Tab>(() => (orders.some((o) => o.status === "new") ? "new" : "all"));
  const [search, setSearch] = useState("");
  const nowDate = new Date(now);

  // Pedidos que llegan mientras el panel está abierto
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const counts = Object.fromEntries(
    ORDER_TABS.map(({ id }) => [id, id === "all" ? orders.length : orders.filter((o) => o.status === id).length]),
  ) as Record<Tab, number>;
  const searching = search.trim().length > 0;
  // Al buscar se busca en todos los pedidos, no solo en la pestaña
  const shown = orders.filter((o) => (searching || tab === "all" || o.status === tab) && matchesOrderSearch(o, search));

  async function share() {
    const url = storeUrl(store.slug);
    try {
      if (navigator.share) await navigator.share({ title: store.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ tone: "success", title: "Copiamos el link de tu tienda" });
      }
    } catch {
      // El usuario cerró el menú de compartir
    }
  }

  const actionButton = (order: Order, className?: string) => {
    const next = NEXT_ACTION[order.status];
    if (!next) {
      return (
        <Link href={`/panel/pedidos/${order.id}`} className={buttonStyles({ variant: "ghost", className })}>
          Ver
        </Link>
      );
    }
    return (
      <Button
        variant={order.status === "new" ? "primary" : "secondary"}
        className={className}
        loading={pendingId === order.id}
        onClick={() => run(order, next.action)}
      >
        {next.label}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-ink-muted">{todayHeading}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">Pedidos</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink-muted sm:inline">{storeUrlLabel(store.slug)}</span>
          <Button variant="secondary" onClick={share}>
            <Share2 aria-hidden />
            Compartir tienda
          </Button>
        </div>
      </div>

      {metrics}

      {lowStockCount > 0 && (
        <Link
          href="/panel/productos?filtro=low"
          className="flex items-center lg:hidden gap-3 rounded-card border border-warning/30 bg-warning-soft p-3.5 text-sm hover:border-warning/60 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <TriangleAlert aria-hidden size={20} className="shrink-0 text-warning" />
          <span className="flex-1 font-semibold">
            {lowStockCount === 1 ? "1 producto con stock bajo" : `${lowStockCount} productos con stock bajo`}
          </span>
          <span className="flex items-center font-bold text-warning">
            Revisar <ChevronRight aria-hidden size={18} />
          </span>
        </Link>
      )}

      <Input
        label="Buscar pedidos"
        hideLabel
        type="search"
        placeholder="Buscar por cliente, celular o número"
        icon={<Search />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!searching && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Pedidos por estado">
          {ORDER_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                tab === id ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink hover:border-border-strong",
              )}
            >
              {label} · {counts[id]}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <Card padding="lg" className="flex flex-col items-center gap-2 py-12 text-center">
          <ReceiptText aria-hidden size={32} className="text-ink-muted" />
          <h2 className="text-lg font-bold">
            {searching ? "No encontramos pedidos" : orders.length === 0 ? "Aún no tienes pedidos" : "Nada por aquí"}
          </h2>
          <p className="max-w-sm text-[15px] text-ink-muted">
            {searching
              ? "Prueba con otro nombre, celular o número de pedido."
              : orders.length === 0
                ? "Comparte el link de tu tienda en WhatsApp, Instagram o TikTok para recibir tus primeros pedidos."
                : "No hay pedidos en este estado."}
          </p>
        </Card>
      ) : (
        <>
          {/* Celular: tarjetas */}
          <ul className="flex flex-col gap-3 lg:hidden">
            {shown.map((order) => (
              <li key={order.id}>
                <Card padding="none" className="flex flex-col gap-2.5 p-4">
                  <Link href={`/panel/pedidos/${order.id}`} className="flex flex-col gap-1.5 focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-bold">
                        {formatOrderNumber(order.number)} · {order.customer.name}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-snug text-ink-muted">
                      {itemsSummary(order)} · {fulfillmentSummary(order)}
                      {order.deliveryDate && ` · ${formatDeliveryDate(order.deliveryDate, nowDate)}`}
                    </span>
                    <span className="flex items-center justify-between text-sm">
                      <span className="font-bold">
                        {formatSoles(order.totalCents)}
                        <span className="font-medium text-ink-muted"> · {PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
                      </span>
                      <span className="text-[13px] text-ink-muted">{formatOrderTime(order.createdAt, nowDate)}</span>
                    </span>
                  </Link>
                  {NEXT_ACTION[order.status] && actionButton(order, "w-full")}
                </Card>
              </li>
            ))}
          </ul>

          {/* Computadora: tabla */}
          <Card padding="none" className="hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left text-[13px] text-ink-muted">
                <tr>
                  {["Pedido", "Cliente", "Entrega", "Pago", "Total", "Estado"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((order) => (
                  <tr key={order.id} className="hover:bg-bg/60">
                    <td className="px-4 py-3">
                      <Link href={`/panel/pedidos/${order.id}`} className="font-bold hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
                        {formatOrderNumber(order.number)}
                      </Link>
                      <span className="block text-[13px] text-ink-muted">{formatOrderTime(order.createdAt, nowDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{order.customer.name}</span>
                      <span className="block text-[13px] text-ink-muted">{customerPhone(order)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{fulfillmentSummary(order)}</span>
                      {order.deliveryDate && (
                        <span className="block text-[13px] text-ink-muted">{formatDeliveryDate(order.deliveryDate, nowDate)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</td>
                    <td className="px-4 py-3 font-bold whitespace-nowrap">{formatSoles(order.totalCents)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-2 text-right">{actionButton(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
