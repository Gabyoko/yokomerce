"use client";

import { Check, ChevronLeft, Clock, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { formatDateLong, formatDeliveryDate, formatTime, todayInLima } from "@/shared/lib/dates";
import { formatSoles } from "@/shared/lib/money";
import { formatOrderNumber, PAYMENT_METHOD_LABELS } from "@/shared/lib/orders";
import type { Order } from "@/shared/types";
import { Button, buttonStyles, Card, Modal, Textarea, useToast } from "@/shared/ui";

import { updateOrderNotes } from "../api";
import { useOrderAction } from "../hooks/useOrderAction";
import {
  cancelEffect,
  canCancel,
  customerPhone,
  customerWhatsAppUrl,
  NEXT_ACTION,
  ORDER_STEPS,
  receivedAt,
  stepIndex,
} from "../lib/order-flow";
import { OrderStatusBadge } from "./OrderStatusBadge";

/** Stock actual de cada variante del pedido (para "2 de 5" en lo reservado). */
export type OrderStock = Record<string, { onHand: number; reserved: number }>;

type OrderDetailProps = {
  order: Order;
  storeName: string;
  stock: OrderStock;
  /** Hora del servidor, para que los textos no cambien al hidratar. */
  now: string;
};

const NOTES_MAX = 500;

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card padding="lg" className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 text-[15px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Detalle del pedido (design/PedidoDetalle.dc.html). */
export function OrderDetail({ order, storeName, stock, now }: OrderDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { run, pendingId } = useOrderAction();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const nowDate = new Date(now);

  const next = NEXT_ACTION[order.status];
  const step = stepIndex(order.status);
  const busy = pendingId === order.id;
  const whatsapp = customerWhatsAppUrl(order, storeName);
  const tracked = order.items.filter((i) => i.tracksStock);
  const { fulfillment } = order;
  const initials = order.customer.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const reservedUntil = `${formatDeliveryDate(todayInLima(new Date(order.reservedUntil)), nowDate).toLowerCase()} a las ${formatTime(order.reservedUntil)}`;
  const notesChanged = (order.notes ?? "") !== notes.trim();

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await updateOrderNotes(order.id, notes.trim() || null);
      toast({ tone: "success", title: "Guardamos la nota" });
      router.refresh();
    } catch (error) {
      toast({ tone: "error", title: "No pudimos guardar la nota", description: error instanceof ApiError ? error.message : undefined });
    } finally {
      setSavingNotes(false);
    }
  }

  const paymentState =
    order.status === "new"
      ? "por verificar"
      : order.status === "expired" || (order.status === "cancelled" && !order.paidAt)
        ? "no se confirmó"
        : "confirmado";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <Link
          href="/panel"
          aria-label="Volver a pedidos"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft aria-hidden size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Pedido {formatOrderNumber(order.number)}</h1>
          <p className="text-[13px] text-ink-muted">Recibido {receivedAt(order.createdAt, nowDate)}</p>
        </div>
        <OrderStatusBadge status={order.status} size="md" />
      </div>

      {step >= 0 ? (
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Avance del pedido">
          {ORDER_STEPS.map((s, i) => (
            <li key={s.status} className="flex flex-col gap-1.5" aria-current={i === step ? "step" : undefined}>
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
              <span className={cn("flex items-center gap-1 text-xs", i <= step ? "font-bold text-ink" : "text-ink-muted")}>
                {i < step && <Check aria-hidden size={12} />}
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p role="status" className="rounded-card border border-danger/30 bg-danger-soft p-3.5 text-sm">
          {order.status === "cancelled"
            ? `Este pedido se canceló${order.cancelledAt ? ` ${receivedAt(order.cancelledAt, nowDate)}` : ""}.`
            : "Este pedido venció: no se confirmó el pago a tiempo y la reserva se liberó."}
        </p>
      )}

      <Card padding="lg" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-hover">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold">{order.customer.name}</p>
            <p className="text-sm text-ink-muted">{customerPhone(order)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer" className={buttonStyles({ variant: "whatsapp", className: "flex-1" })}>
              <MessageCircle aria-hidden />
              Escribir
            </a>
          )}
          <a href={`tel:+51${order.customer.phone}`} className={buttonStyles({ variant: "secondary" })} aria-label={`Llamar a ${order.customer.name}`}>
            <Phone aria-hidden />
            <span className="sm:hidden">Llamar</span>
          </a>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Entrega">
          <dl className="flex flex-col gap-2">
            <Row label="Tipo">
              {fulfillment.type === "pickup" ? "Recojo en tienda" : fulfillment.type === "delivery" ? "Delivery" : "Envío a provincia"}
              {fulfillment.zoneName && ` · ${fulfillment.zoneName}`}
            </Row>
            {fulfillment.city && <Row label="Ciudad">{fulfillment.city}</Row>}
            {fulfillment.address && <Row label="Dirección">{fulfillment.address}</Row>}
            {fulfillment.reference && <Row label="Referencia">{fulfillment.reference}</Row>}
            {order.deliveryDate && <Row label="Fecha">{capitalize(formatDateLong(order.deliveryDate))}</Row>}
          </dl>
        </Section>

        <Section title="Productos">
          <ul className="flex flex-col gap-2.5">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 text-[15px]">
                <span className="min-w-0">
                  <span className="font-semibold">
                    {item.quantity} × {item.productName}
                    {item.variantLabel && ` (${item.variantLabel})`}
                  </span>
                  {Object.entries(item.customValues).map(([label, value]) => (
                    <span key={label} className="block text-[13px] break-words text-ink-muted">
                      {label}: “{value}”
                    </span>
                  ))}
                </span>
                <span className="shrink-0 font-semibold">{formatSoles(item.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-[15px]">
            {fulfillment.type !== "pickup" && (
              <div className="flex justify-between">
                <dt className="text-ink-muted">{fulfillment.type === "delivery" ? "Delivery" : "Envío"}</dt>
                <dd>{order.deliveryFeeCents === null ? "A coordinar" : formatSoles(order.deliveryFeeCents)}</dd>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatSoles(order.totalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Pago</dt>
              <dd>
                {PAYMENT_METHOD_LABELS[order.paymentMethod]} · {paymentState}
              </dd>
            </div>
          </dl>
        </Section>
      </div>

      {order.status === "new" && tracked.length > 0 && (
        <Section title="Stock reservado para este pedido">
          <ul className="flex flex-col gap-2">
            {tracked.map((item, i) => {
              const current = stock[item.variantId];
              return (
                <li key={i} className="flex justify-between gap-3 text-[15px]">
                  <span>
                    {item.productName}
                    {item.variantLabel && ` (${item.variantLabel})`}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {item.quantity}
                    {current && <span className="font-normal text-ink-muted"> de {current.onHand}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2 text-[13px] text-ink-muted">
            <Clock aria-hidden size={16} className="mt-px shrink-0 text-primary" />
            Si no confirmas el pago antes de {reservedUntil}, la reserva se libera sola y el stock vuelve al catálogo.
          </p>
        </Section>
      )}

      <Section title="Nota interna">
        <Textarea
          label={<span className="sr-only">Nota interna</span>}
          rows={2}
          maxLength={NOTES_MAX}
          placeholder="Solo tú la ves. Ej. Llamar antes de llegar."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {notesChanged && (
          <Button variant="secondary" className="self-start" loading={savingNotes} onClick={saveNotes}>
            Guardar nota
          </Button>
        )}
      </Section>

      {(next || canCancel(order.status)) && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex gap-2 rounded-card border border-border bg-surface p-3 shadow-lg lg:bottom-4">
          {canCancel(order.status) && (
            <Button variant="secondary" size="lg" className="text-danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Cancelar
            </Button>
          )}
          {next && (
            <Button size="lg" className="flex-1" loading={busy} onClick={() => run(order, next.action)}>
              {next.label}
            </Button>
          )}
        </div>
      )}

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={`¿Cancelar el pedido ${formatOrderNumber(order.number)}?`}
        description={cancelEffect(order)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={busy}>
              No, volver
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (await run(order, "cancel")) setConfirmCancel(false);
              }}
            >
              Sí, cancelar
            </Button>
          </>
        }
      />
    </div>
  );
}
