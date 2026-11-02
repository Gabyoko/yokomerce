import { CircleCheck, CircleX, Clock, MessageCircle, PackageCheck } from "lucide-react";
import Link from "next/link";

import { storeInitials } from "@/features/catalog";
import { cn } from "@/shared/lib/cn";
import { formatOrderNumber, ORDER_STATUS_LABELS } from "@/shared/lib/orders";
import { SITE_URL } from "@/shared/lib/site";
import type { PublicOrder, Store } from "@/shared/types";
import { Badge, buttonStyles } from "@/shared/ui";

import { orderStatusCopy, reservationDeadline, reservesStock } from "../lib/order-status";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "../lib/whatsapp";

type OrderReadyProps = {
  store: Pick<Store, "name" | "slug" | "whatsapp" | "logoUrl">;
  order: PublicOrder;
};

const statusIcon = {
  new: { icon: CircleCheck, className: "bg-whatsapp-soft text-whatsapp" },
  paid: { icon: CircleCheck, className: "bg-whatsapp-soft text-whatsapp" },
  preparing: { icon: Clock, className: "bg-warning-soft text-warning" },
  delivered: { icon: PackageCheck, className: "bg-whatsapp-soft text-whatsapp" },
  cancelled: { icon: CircleX, className: "bg-danger-soft text-danger" },
  expired: { icon: Clock, className: "bg-danger-soft text-danger" },
} as const;

/** Pedido listo y vista previa del mensaje (design/Enviado.dc.html). */
export function OrderReady({ store, order }: OrderReadyProps) {
  const isNew = order.status === "new";
  const closed = order.status === "cancelled" || order.status === "expired";
  const copy = orderStatusCopy(order.status, store.name);
  const { icon: Icon, className: iconClass } = statusIcon[order.status];
  const message = buildWhatsAppMessage(order, store, SITE_URL);
  const number = formatOrderNumber(order.number);
  // Si es nuevo, se envía el pedido; si no, solo se abre el chat con la tienda
  const whatsappUrl = buildWhatsAppUrl(store.whatsapp, isNew ? message : `Hola, te escribo por mi pedido ${number}.`);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pt-10 lg:pt-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className={cn("flex size-18 items-center justify-center rounded-full", iconClass)}>
          <Icon aria-hidden size={36} strokeWidth={2.2} />
        </span>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">{copy.title}</h1>
        {!isNew && (
          <Badge tone={closed ? "danger" : "neutral"} size="md">
            Pedido {number} · {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        )}
        <p className="text-[15px] leading-normal text-ink-muted">{copy.text}</p>
      </div>

      <section aria-label={isNew ? "Vista previa del mensaje" : "Detalle del pedido"} className="rounded-[20px] bg-border/60 p-3.5">
        <div className="mb-3 flex items-center gap-2.5">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
              {storeInitials(store.name)}
            </span>
          )}
          <span className="text-sm font-bold">{store.name}</span>
          <span className="ml-auto text-xs text-ink-muted">{isNew ? "Vista previa del mensaje" : `Pedido ${number}`}</span>
        </div>
        <p className="ml-8 rounded-[16px_4px_16px_16px] bg-whatsapp-soft px-3.5 py-3 text-sm leading-relaxed break-words whitespace-pre-line text-ink">
          {message}
        </p>
      </section>

      {isNew && reservesStock(order) && (
        <p className="flex items-start gap-2.5 rounded-control border border-border bg-surface px-3.5 py-3 text-sm leading-snug">
          <Clock aria-hidden size={18} className="mt-px shrink-0 text-primary" />
          <span>Separamos tus productos hasta {reservationDeadline(order.reservedUntil)} mientras confirmas el pago.</span>
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {closed ? (
          <>
            <Link href={`/${store.slug}`} className={buttonStyles({ size: "lg", fullWidth: true, className: "rounded-[16px]" })}>
              Hacer un nuevo pedido
            </Link>
            <a href={whatsappUrl} className={buttonStyles({ variant: "secondary", size: "lg", fullWidth: true, className: "rounded-[16px]" })}>
              <MessageCircle aria-hidden />
              Escribir a {store.name}
            </a>
          </>
        ) : (
          <>
            <a
              href={whatsappUrl}
              className={buttonStyles({ variant: isNew ? "whatsapp" : "secondary", size: "lg", fullWidth: true, className: "rounded-[16px]" })}
            >
              <MessageCircle aria-hidden />
              {isNew ? "Abrir WhatsApp y enviar" : `Escribir a ${store.name}`}
            </a>
            <Link
              href={`/${store.slug}`}
              className="flex min-h-12 items-center justify-center text-[15px] font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
            >
              Volver a la tienda
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
