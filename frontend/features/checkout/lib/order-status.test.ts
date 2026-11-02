import { describe, expect, it } from "vitest";

import { orderStatusCopy, reservationDeadline, reservesStock } from "./order-status";

// Viernes 30 de octubre de 2026, 10 a. m. en Lima
const NOW = new Date("2026-10-30T15:00:00Z");

describe("reservationDeadline", () => {
  it("hoy, mañana o la fecha, con hora de Lima", () => {
    expect(reservationDeadline("2026-10-30T20:28:00Z", NOW)).toBe("hoy a las 3:28 p. m.");
    expect(reservationDeadline("2026-10-31T15:00:00Z", NOW)).toBe("mañana a las 10:00 a. m.");
    expect(reservationDeadline("2026-11-01T15:00:00Z", NOW)).toBe("el dom 1 nov a las 10:00 a. m.");
  });
});

describe("reservesStock", () => {
  it("solo si algún producto controla stock", () => {
    expect(reservesStock({ items: [{ tracksStock: false }, { tracksStock: true }] as never })).toBe(true);
    expect(reservesStock({ items: [{ tracksStock: false }] as never })).toBe(false);
  });
});

describe("orderStatusCopy", () => {
  it("usa el nombre de la tienda", () => {
    expect(orderStatusCopy("new", "Dulces de Ana").text).toContain("Dulces de Ana te confirmará el pago");
    expect(orderStatusCopy("expired", "X").title).toBe("Este pedido venció");
  });
});
