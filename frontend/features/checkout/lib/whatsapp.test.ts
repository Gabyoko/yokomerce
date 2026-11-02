import { describe, expect, it } from "vitest";

import type { PublicOrder } from "@/shared/types";

import { buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsapp";

const store = { name: "Dulces de Ana", slug: "dulcesdeana" };
const SITE = "https://yokomerce.pe";

/** El pedido del ejemplo de SPEC.md, sección 7. */
const order: PublicOrder = {
  number: 42,
  publicToken: "abc123",
  status: "new",
  customer: { name: "María López", phone: "987654321" },
  fulfillment: {
    type: "delivery",
    zoneName: "Santiago de Surco",
    city: null,
    address: "Av. Primavera 123, dpto. 402",
    reference: "Frente al parque",
  },
  deliveryDate: "2026-10-31",
  paymentMethod: "yape",
  items: [
    {
      variantId: "v1",
      productName: "Torta de chocolate",
      variantLabel: "Mediana",
      unitPriceCents: 4500,
      quantity: 2,
      lineTotalCents: 9000,
      customValues: { Dedicatoria: "Feliz cumpleaños, Lucía" },
      tracksStock: true,
    },
    {
      variantId: "v2",
      productName: "Alfajores x12",
      variantLabel: "",
      unitPriceCents: 1800,
      quantity: 1,
      lineTotalCents: 1800,
      customValues: {},
      tracksStock: true,
    },
  ],
  subtotalCents: 10800,
  deliveryFeeCents: 800,
  totalCents: 11600,
  reservedUntil: "2026-10-30T15:00:00Z",
  createdAt: "2026-10-29T15:00:00Z",
  paidAt: null,
  deliveredAt: null,
  cancelledAt: null,
};

describe("buildWhatsAppMessage", () => {
  it("coincide exactamente con el ejemplo de la SPEC", () => {
    expect(buildWhatsAppMessage(order, store, SITE)).toBe(
      [
        "Nuevo pedido #0042 · Dulces de Ana",
        "",
        "2 × Torta de chocolate (Mediana) — S/ 90.00",
        "   Dedicatoria: Feliz cumpleaños, Lucía",
        "1 × Alfajores x12 — S/ 18.00",
        "",
        "Subtotal: S/ 108.00",
        "Delivery (Santiago de Surco): S/ 8.00",
        "Total: S/ 116.00",
        "",
        "Cliente: María López · 987 654 321",
        "Entrega: Av. Primavera 123, dpto. 402 (Frente al parque)",
        "Fecha: sábado 31 de octubre",
        "Pago: Yape",
        "",
        "Ver pedido: https://yokomerce.pe/dulcesdeana/pedido/abc123",
      ].join("\n"),
    );
  });

  it("recojo: sin línea de costo, sin fecha si la tienda no la usa", () => {
    const message = buildWhatsAppMessage(
      {
        ...order,
        fulfillment: { type: "pickup", zoneName: null, city: null, address: null, reference: null },
        deliveryFeeCents: 0,
        totalCents: 10800,
        deliveryDate: null,
        paymentMethod: "cash",
      },
      store,
      SITE,
    );
    expect(message).toContain("Subtotal: S/ 108.00\nTotal: S/ 108.00");
    expect(message).toContain("Entrega: Recojo en tienda");
    expect(message).not.toContain("Fecha:");
    expect(message).toContain("Pago: Efectivo");
  });

  it("envío a coordinar con ciudad", () => {
    const message = buildWhatsAppMessage(
      {
        ...order,
        fulfillment: { type: "shipping", zoneName: null, city: "Cusco", address: "Av. Sol 100", reference: null },
        deliveryFeeCents: null,
        totalCents: 10800,
        paymentMethod: "transfer",
      },
      store,
      SITE,
    );
    expect(message).toContain("Envío a Cusco: a coordinar");
    expect(message).toContain("Entrega: Av. Sol 100, Cusco\n");
    expect(message).toContain("Pago: Transferencia");
  });

  it("envío con precio fijo", () => {
    const message = buildWhatsAppMessage(
      { ...order, fulfillment: { type: "shipping", zoneName: null, city: "Piura", address: "Calle Lima 735", reference: null }, deliveryFeeCents: 1500 },
      store,
      SITE,
    );
    expect(message).toContain("Envío a Piura: S/ 15.00");
  });

  it("omite la referencia vacía y los campos extra vacíos", () => {
    const message = buildWhatsAppMessage(
      {
        ...order,
        fulfillment: { ...order.fulfillment, reference: null },
        items: [{ ...order.items[0]!, customValues: { Dedicatoria: "" } }],
      },
      store,
      SITE,
    );
    expect(message).toContain("Entrega: Av. Primavera 123, dpto. 402\n");
    expect(message).not.toContain("Dedicatoria");
  });

  it("no duplica la barra del sitio", () => {
    expect(buildWhatsAppMessage(order, store, "http://localhost:3000/")).toContain(
      "Ver pedido: http://localhost:3000/dulcesdeana/pedido/abc123",
    );
  });
});

describe("buildWhatsAppUrl", () => {
  it("usa wa.me con el número de la tienda y el texto codificado", () => {
    expect(buildWhatsAppUrl("51912345678", "Hola & chau\n#0042")).toBe(
      "https://wa.me/51912345678?text=Hola%20%26%20chau%0A%230042",
    );
  });
});
