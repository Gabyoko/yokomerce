"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { catalogAvailability, fitCartToStock, linesTotal, resolveCartLines, useCart } from "@/features/cart";
import { cn } from "@/shared/lib/cn";
import { formatSoles } from "@/shared/lib/money";
import type { Catalog, FulfillmentType } from "@/shared/types";
import { Button, buttonStyles, Card } from "@/shared/ui";
import { StoreColumns } from "@/shared/ui/layout";

import { feeLine, fulfillmentOptions, initialFulfillment } from "../lib/fulfillment";
import { CartLineCard } from "./CartLineCard";
import { ChoiceCard } from "./ChoiceCard";
import { FlowHeader } from "./FlowHeader";
import { CartReviewSkeleton } from "./Skeletons";
import { StockNotice } from "./StockNotice";
import { EmptyCart, productCount, Totals } from "./Summary";

/** Pantalla del carrito (design/Carrito.dc.html). Precios y stock vienen del catálogo de la API. */
export function CartReview({ catalog }: { catalog: Pick<Catalog, "store" | "products" | "deliveryZones"> }) {
  const { store, products, deliveryZones: zones } = catalog;
  const { slug } = store;
  const cart = useCart(slug);
  const options = fulfillmentOptions({ store, zones });
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(() => initialFulfillment(options));

  const header = (
    <FlowHeader
      backHref={`/${slug}`}
      backLabel={`Volver a ${store.name}`}
      title="Tu pedido"
      subtitle={cart.ready && cart.count > 0 ? `${store.name} · ${productCount(cart.count)}` : store.name}
    />
  );

  if (!cart.ready) return <CartReviewSkeleton header={header} />;
  if (cart.count === 0) {
    return (
      <div className="flex flex-col">
        {header}
        <EmptyCart slug={slug} />
      </div>
    );
  }

  const fit = fitCartToStock(cart.items, catalogAvailability(products));
  const lines = resolveCartLines(cart.items, products);
  const subtotal = linesTotal(lines);
  const blocked = fit.adjustments.length > 0;
  const checkoutHref = `/${slug}/checkout${fulfillment ? `?entrega=${fulfillment}` : ""}`;

  const continueLink = (className?: string) =>
    blocked ? (
      <Button size="lg" fullWidth disabled className={cn("justify-between rounded-[16px] px-5", className)}>
        <span>Continuar</span>
        <span>{formatSoles(subtotal)}</span>
      </Button>
    ) : (
      <Link href={checkoutHref} className={buttonStyles({ size: "lg", fullWidth: true, className: cn("justify-between rounded-[16px] px-5", className) })}>
        <span>Continuar</span>
        <span>{formatSoles(subtotal)}</span>
      </Link>
    );

  return (
    <div className="flex flex-col gap-2 lg:gap-6">
      {header}
      <div className="px-5 pt-1 lg:px-0">
        <StoreColumns
          hideAsideOnMobile={false}
          aside={
            <div className="flex flex-col gap-4">
              {options.length > 0 && (
                <fieldset>
                  <legend className="mb-2.5 text-base font-bold">¿Cómo lo recibes?</legend>
                  <div className="grid grid-cols-2 gap-2.5">
                    {options.map((option) => (
                      <ChoiceCard
                        key={option.type}
                        name="entrega"
                        value={option.type}
                        checked={fulfillment === option.type}
                        onChange={() => setFulfillment(option.type)}
                        className="min-h-16 flex-col items-start justify-center gap-0 rounded-[16px] text-left"
                      >
                        <span className="text-[15px] font-bold">{option.title}</span>
                        <span className="text-[13px] text-ink-muted">{option.detail}</span>
                      </ChoiceCard>
                    ))}
                  </div>
                </fieldset>
              )}
              <Card>
                <Totals subtotalCents={subtotal} count={cart.count} fee={feeLine({ store, zones }, fulfillment, null)} />
              </Card>
              <div className="hidden lg:block">{continueLink()}</div>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {blocked && (
              <StockNotice title="Algunos productos cambiaron" adjustments={fit.adjustments} products={products}>
                <Button variant="dark" className="self-start" onClick={() => cart.replace(fit.items)}>
                  Ajustar mi carrito
                </Button>
              </StockNotice>
            )}
            {lines.length > 0 && (
              <Card padding="none">
                <ul className="divide-y divide-border">
                  {lines.map((line) => (
                    <li key={line.index}>
                      <CartLineCard
                        slug={slug}
                        line={line}
                        onQuantityChange={(quantity) => cart.setQuantity(line.index, quantity)}
                        onRemove={() => cart.remove(line.index)}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Link
              href={`/${slug}`}
              className="flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Plus aria-hidden size={18} />
              Agregar más productos
            </Link>
          </div>
        </StoreColumns>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pt-3.5 pb-[max(1.375rem,env(safe-area-inset-bottom))] lg:hidden">
        {continueLink()}
      </div>
    </div>
  );
}
