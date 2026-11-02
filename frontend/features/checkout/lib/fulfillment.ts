import { formatSoles } from "@/shared/lib/money";
import type { Cents, DeliveryZone, FulfillmentType, Store } from "@/shared/types";

export type FulfillmentContext = {
  store: Pick<Store, "features" | "shippingFeeCents" | "pickupAddress">;
  zones: DeliveryZone[];
};

export type FulfillmentOption = { type: FulfillmentType; title: string; detail: string };

const price = (cents: Cents) => (cents === 0 ? "Gratis" : formatSoles(cents, { trimZeroDecimals: true }));

/** Formas de entrega activas de la tienda, en el orden en que se muestran. */
export function fulfillmentOptions({ store, zones }: FulfillmentContext): FulfillmentOption[] {
  const options: FulfillmentOption[] = [];
  const { features } = store;
  if (features.deliveryZones && zones.length > 0) {
    const prices = zones.map((z) => z.priceCents);
    const min = Math.min(...prices);
    const detail = prices.every((p) => p === min) ? price(min) : `Desde ${price(min)}`;
    options.push({ type: "delivery", title: "Delivery", detail });
  }
  if (features.pickup) options.push({ type: "pickup", title: "Recojo en tienda", detail: "Gratis" });
  if (features.shipping) {
    const detail = store.shippingFeeCents === null ? "Costo a coordinar" : price(store.shippingFeeCents);
    options.push({ type: "shipping", title: "Envío a provincia", detail });
  }
  return options;
}

/** Elige la forma de entrega inicial: la pedida si está activa; si solo hay una, esa. */
export function initialFulfillment(options: FulfillmentOption[], preferred?: string | null): FulfillmentType | null {
  const match = options.find((o) => o.type === preferred);
  if (match) return match.type;
  return options.length === 1 ? (options[0]?.type ?? null) : null;
}

/** Línea de entrega del resumen. `amount`: null = "a coordinar", undefined = falta elegir. */
export type FeeLine = { label: string; amount: Cents | null | undefined; hint?: string };

/**
 * Costo de entrega para el resumen. Es solo referencia: el total final lo calcula la API.
 */
export function feeLine(
  ctx: FulfillmentContext,
  type: FulfillmentType | null,
  zoneId: string | null,
): FeeLine | null {
  if (type === "pickup") return { label: "Recojo en tienda", amount: 0 };
  if (type === "shipping") return { label: "Envío", amount: ctx.store.shippingFeeCents };
  if (type === "delivery") {
    const zone = ctx.zones.find((z) => z.id === zoneId);
    return zone
      ? { label: `Delivery a ${zone.name}`, amount: zone.priceCents }
      : { label: "Delivery", amount: undefined, hint: "Según tu distrito" };
  }
  return null;
}
