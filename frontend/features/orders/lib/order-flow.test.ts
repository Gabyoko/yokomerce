import { describe, expect, it } from "vitest";

import type { Order } from "@/shared/types";

import {
  cancelEffect,
  canCancel,
  customerWhatsAppUrl,
  fulfillmentSummary,
  itemsSummary,
  matchesOrderSearch,
  NEXT_ACTION,
  receivedAt,
  stepIndex,
} from "./order-flow";

const order: Order = {
  id: "or_1",
  number: 42,
  publicToken: "t",
  status: "new",
  customer: { name: "María López", phone: "987654321" },
  fulfillment: { type: "delivery", zoneName: "Santiago de Surco", city: null, address: "Av. Primavera 123", reference: null },
  deliveryDate: "2026-10-31",
  paymentMethod: "yape",
  items: [
    { variantId: "v1", productName: "Torta de chocolate", variantLabel: "Mediana", unitPriceCents: 4500, quantity: 2, lineTotalCents: 9000, customValues: {}, tracksStock: true },
    { variantId: "v2", productName: "Alfajores x12", variantLabel: "", unitPriceCents: 1800, quantity: 1, lineTotalCents: 1800, customValues: {}, tracksStock: true },
  ],
  subtotalCents: 10800,
  deliveryFeeCents: 800,
  totalCents: 11600,
  reservedUntil: "2026-10-30T15:28:00Z",
  createdAt: "2026-10-29T15:28:00Z",
  paidAt: null,
  deliveredAt: null,
  cancelledAt: null,
  notes: null,
};

describe("flujo", () => {
  it("siguiente acción por estado", () => {
    expect(NEXT_ACTION.new?.label).toBe("Confirmar pago");
    expect(NEXT_ACTION.paid?.action).toBe("prepare");
    expect(NEXT_ACTION.preparing?.action).toBe("deliver");
    expect(NEXT_ACTION.delivered).toBeNull();
    expect(NEXT_ACTION.expired).toBeNull();
  });

  it("se cancela solo desde nuevo, pagado o preparando", () => {
    expect(["new", "paid", "preparing"].every((s) => canCancel(s as Order["status"]))).toBe(true);
    expect(canCancel("delivered") || canCancel("cancelled") || canCancel("expired")).toBe(false);
  });

  it("explica qué pasa con el stock al cancelar", () => {
    expect(cancelEffect(order)).toMatch(/libera/);
    expect(cancelEffect({ ...order, status: "paid" })).toMatch(/vuelven a tu stock/);
    expect(cancelEffect({ ...order, items: [{ ...order.items[0]!, tracksStock: false }] })).toMatch(/cancelado/);
  });

  it("paso de la barra de progreso", () => {
    expect(stepIndex("new")).toBe(0);
    expect(stepIndex("delivered")).toBe(3);
    expect(stepIndex("cancelled")).toBe(-1);
  });
});

describe("textos", () => {
  it("resumen de productos y entrega", () => {
    expect(itemsSummary(order)).toBe("2 × Torta de chocolate (Mediana), 1 × Alfajores x12");
    expect(fulfillmentSummary(order)).toBe("Delivery · Santiago de Surco");
    expect(fulfillmentSummary({ fulfillment: { ...order.fulfillment, type: "pickup" } })).toBe("Recojo en tienda");
    expect(fulfillmentSummary({ fulfillment: { ...order.fulfillment, type: "shipping", city: "Arequipa" } })).toBe("Envío · Arequipa");
  });

  it("cuándo llegó, en hora de Lima", () => {
    const now = new Date("2026-10-29T20:00:00Z");
    expect(receivedAt("2026-10-29T15:28:00Z", now)).toBe("hoy, 10:28 a. m.");
    expect(receivedAt("2026-10-28T15:28:00Z", now)).toBe("ayer, 10:28 a. m.");
    expect(receivedAt("2026-10-26T14:00:00Z", now)).toBe("lun 26 oct, 9:00 a. m.");
  });

  it("WhatsApp al cliente con saludo", () => {
    const url = customerWhatsAppUrl(order, "Dulces de Ana");
    expect(url).toBe(
      `https://wa.me/51987654321?text=${encodeURIComponent("Hola María, te escribo de Dulces de Ana por tu pedido #0042.")}`,
    );
  });
});

describe("matchesOrderSearch", () => {
  it("por nombre sin tildes, celular o número", () => {
    expect(matchesOrderSearch(order, "maria")).toBe(true);
    expect(matchesOrderSearch(order, "654")).toBe(true);
    expect(matchesOrderSearch(order, "#42")).toBe(true);
    expect(matchesOrderSearch(order, "jorge")).toBe(false);
    expect(matchesOrderSearch(order, "")).toBe(true);
  });
});
