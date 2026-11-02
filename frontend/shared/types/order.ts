// Contrato de datos: copia exacta de SPEC.md, sección 4. No cambiar sin actualizar la SPEC.
import type { Cents, FulfillmentType, ISODate, ISODateTime, OrderStatus, PaymentMethod } from "./common";

export interface OrderItem {
  variantId: string;
  productName: string;                 // copia al momento del pedido
  variantLabel: string;
  unitPriceCents: Cents;
  quantity: number;
  lineTotalCents: Cents;
  customValues: Record<string, string>; // { "Dedicatoria": "Feliz cumpleaños, Lucía" }
  tracksStock: boolean;
}

export interface Order {
  id: string;
  number: number;                      // 42 → se muestra "#0042"
  publicToken: string;
  status: OrderStatus;
  customer: { name: string; phone: string };
  fulfillment: {
    type: FulfillmentType;
    zoneName: string | null;
    city: string | null;
    address: string | null;
    reference: string | null;
  };
  deliveryDate: ISODate | null;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotalCents: Cents;
  deliveryFeeCents: Cents | null;      // null = envío a coordinar
  totalCents: Cents;
  reservedUntil: ISODateTime;
  createdAt: ISODateTime;
  paidAt: ISODateTime | null;
  deliveredAt: ISODateTime | null;
  cancelledAt: ISODateTime | null;
  notes: string | null;                // nota interna del negocio
}

/** Lo que ve el cliente en /[slug]/pedido/[token] */
export type PublicOrder = Omit<Order, "id" | "notes">;

export interface CreateOrderInput {
  storeSlug: string;
  items: { variantId: string; quantity: number; customValues: Record<string, string> }[];
  customer: { name: string; phone: string };
  fulfillment: {
    type: FulfillmentType;
    zoneId?: string;
    city?: string;
    address?: string;
    reference?: string;
  };
  deliveryDate?: ISODate;
  paymentMethod: PaymentMethod;
}

export type CreateOrderResult =
  | { ok: true; order: PublicOrder }
  | { ok: false; error: "out_of_stock"; items: { variantId: string; available: number }[] }
  | { ok: false; error: "validation"; fields: Record<string, string> }
  | { ok: false; error: "rate_limited" };
