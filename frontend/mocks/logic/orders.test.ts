import { beforeEach, describe, expect, it } from "vitest";

import type { CreateOrderInput, CreateOrderResult } from "@/shared/types";

import { resetDb } from "../db";
import type { MockDb, OrderRecord } from "../types";
import { MockApiError } from "./errors";
import {
  canTransition,
  cancelOrder,
  confirmPayment,
  createOrder,
  expireOrders,
  getPublicOrder,
  markDelivered,
  ORDERS_PER_HOUR_PER_PHONE,
  startPreparing,
} from "./orders";
import { availableOf } from "./stock";

const NOW = new Date("2026-10-31T15:00:00Z"); // sábado 31 de octubre, 10:00 a. m. en Lima
const HOUR = 60 * 60_000;

const MEDIANA = "va_da_torta-chocolate_mediana";
const GRANDE = "va_da_torta-chocolate_grande"; // 1 disponible
const KEKE = "va_da_keke-naranja"; // agotado
const TRES_LECHES = "va_da_torta-tres-leches"; // por encargo
const SURCO = "zn_da_santiago-de-surco";

let db: MockDb;
beforeEach(() => {
  db = resetDb(NOW);
});

const stock = (variantId: string) => db.stockItems.find((s) => s.variantId === variantId)!;
const store = (slug: string) => db.stores.find((s) => s.slug === slug)!;

/** Pedido válido en Dulces de Ana; cada prueba cambia solo lo que necesita. */
function input(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    storeSlug: "dulcesdeana",
    items: [{ variantId: MEDIANA, quantity: 1, customValues: { Dedicatoria: "Feliz día" } }],
    customer: { name: "Paula Prueba", phone: "987 111 222" },
    fulfillment: { type: "delivery", zoneId: SURCO, address: "Av. Prueba 123", reference: "Puerta azul" },
    deliveryDate: "2026-11-02",
    paymentMethod: "yape",
    ...overrides,
  };
}

function expectOk(result: CreateOrderResult) {
  if (!result.ok) throw new Error(`Se esperaba ok y llegó ${JSON.stringify(result)}`);
  return result.order;
}

function expectFields(result: CreateOrderResult) {
  if (result.ok || result.error !== "validation") throw new Error(`Se esperaba validation y llegó ${JSON.stringify(result)}`);
  return result.fields;
}

describe("createOrder · éxito", () => {
  it("crea el pedido con el siguiente número, estado nuevo y reserva de 24 horas", () => {
    const next = store("dulcesdeana").nextOrderNumber;
    const order = expectOk(createOrder(db, input(), NOW));
    expect(order.number).toBe(next);
    expect(order.status).toBe("new");
    expect(order.createdAt).toBe("2026-10-31T15:00:00Z");
    expect(order.reservedUntil).toBe("2026-11-01T15:00:00Z");
    expect(order.publicToken).toMatch(/^[a-f0-9]{32}$/);
    expect(store("dulcesdeana").nextOrderNumber).toBe(next + 1);
  });

  it("calcula precios y totales con los datos guardados, no con lo que manda el navegador", () => {
    const tampered = { ...input(), items: [{ variantId: MEDIANA, quantity: 2, customValues: {}, unitPriceCents: 1 }], totalCents: 1 };
    const order = expectOk(createOrder(db, tampered, NOW));
    expect(order.items[0]).toMatchObject({ unitPriceCents: 4500, lineTotalCents: 9000, productName: "Torta de chocolate", variantLabel: "Mediana" });
    expect(order.subtotalCents).toBe(9000);
    expect(order.deliveryFeeCents).toBe(800);
    expect(order.totalCents).toBe(9800);
  });

  it("reserva el stock y registra el movimiento", () => {
    const before = stock(MEDIANA);
    const { onHand, reserved } = before;
    const order = expectOk(createOrder(db, input({ items: [{ variantId: MEDIANA, quantity: 2, customValues: {} }] }), NOW));
    expect(stock(MEDIANA)).toMatchObject({ onHand, reserved: reserved + 2 });
    const movement = db.movements.at(-1)!;
    expect(movement).toMatchObject({ variantId: MEDIANA, type: "reserve", quantity: -2, orderNumber: order.number, createdBy: null });
  });

  it("no devuelve datos internos al cliente", () => {
    const order = expectOk(createOrder(db, input(), NOW));
    expect(order).not.toHaveProperty("id");
    expect(order).not.toHaveProperty("notes");
    expect(order).not.toHaveProperty("storeId");
  });

  it("guarda el celular normalizado y omite la referencia vacía", () => {
    const order = expectOk(
      createOrder(db, input({ customer: { name: "  Paula  ", phone: "+51 987-111-222" }, fulfillment: { type: "delivery", zoneId: SURCO, address: "Av. Prueba 123", reference: "  " } }), NOW),
    );
    expect(order.customer).toEqual({ name: "Paula", phone: "987111222" });
    expect(order.fulfillment.reference).toBeNull();
  });

  it("recojo: costo 0 y sin dirección", () => {
    const order = expectOk(createOrder(db, input({ fulfillment: { type: "pickup", address: "no se usa" } }), NOW));
    expect(order.deliveryFeeCents).toBe(0);
    expect(order.fulfillment).toEqual({ type: "pickup", zoneName: null, city: null, address: null, reference: null });
  });

  it("envío a coordinar: deliveryFeeCents null y total sin envío", () => {
    const order = expectOk(
      createOrder(
        db,
        {
          storeSlug: "fundalab",
          items: [{ variantId: "va_fl_cargador-rapido", quantity: 1, customValues: {} }],
          customer: { name: "Luis Prueba", phone: "912 000 111" },
          fulfillment: { type: "shipping", city: "Cusco", address: "Av. Sol 100" },
          paymentMethod: "transfer",
        },
        NOW,
      ),
    );
    expect(order.deliveryFeeCents).toBeNull();
    expect(order.totalCents).toBe(order.subtotalCents);
    expect(order.deliveryDate).toBeNull();
  });

  it("por encargo: no reserva ni descuenta stock", () => {
    const movementsBefore = db.movements.length;
    const order = expectOk(createOrder(db, input({ items: [{ variantId: TRES_LECHES, quantity: 5, customValues: {} }] }), NOW));
    expect(order.items[0]!.tracksStock).toBe(false);
    expect(db.movements.length).toBe(movementsBefore);
  });

  it("la fecha mínima es hoy + días de anticipación (en Lima)", () => {
    expectOk(createOrder(db, input({ deliveryDate: "2026-11-01" }), NOW));
  });
});

describe("createOrder · stock", () => {
  it("out_of_stock con los disponibles actuales si no alcanza, sin crear nada", () => {
    const ordersBefore = db.orders.length;
    const result = createOrder(db, input({ items: [{ variantId: GRANDE, quantity: 2, customValues: {} }] }), NOW);
    expect(result).toEqual({ ok: false, error: "out_of_stock", items: [{ variantId: GRANDE, available: 1 }] });
    expect(db.orders.length).toBe(ordersBefore);
    expect(availableOf(stock(GRANDE))).toBe(1);
  });

  it("suma las líneas de la misma variante antes de revisar el stock", () => {
    const result = createOrder(
      db,
      input({
        items: [
          { variantId: GRANDE, quantity: 1, customValues: { Dedicatoria: "Para Ana" } },
          { variantId: GRANDE, quantity: 1, customValues: { Dedicatoria: "Para Luis" } },
        ],
      }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, error: "out_of_stock", items: [{ variantId: GRANDE, available: 1 }] });
  });

  it("si un ítem no alcanza, no reserva ninguno", () => {
    const mediana = { ...stock(MEDIANA) };
    createOrder(db, input({ items: [{ variantId: MEDIANA, quantity: 1, customValues: {} }, { variantId: KEKE, quantity: 1, customValues: {} }] }), NOW);
    expect(stock(MEDIANA)).toEqual(mediana);
  });

  it("la última unidad: el primero la reserva y el segundo recibe out_of_stock", () => {
    expectOk(createOrder(db, input({ items: [{ variantId: GRANDE, quantity: 1, customValues: {} }] }), NOW));
    const second = createOrder(db, input({ customer: { name: "Otra persona", phone: "955 444 333" }, items: [{ variantId: GRANDE, quantity: 1, customValues: {} }] }), NOW);
    expect(second).toEqual({ ok: false, error: "out_of_stock", items: [{ variantId: GRANDE, available: 0 }] });
  });
});

describe("createOrder · validación", () => {
  it.each([
    ["nombre corto", { customer: { name: "A", phone: "987111222" } }, "customer.name"],
    ["nombre largo", { customer: { name: "A".repeat(61), phone: "987111222" } }, "customer.name"],
    ["celular inválido", { customer: { name: "Paula", phone: "12345" } }, "customer.phone"],
    ["pago que la tienda no acepta", { paymentMethod: "transfer" }, "paymentMethod"],
    ["envío apagado en la tienda", { fulfillment: { type: "shipping", city: "Cusco", address: "Av. Sol 1" } }, "fulfillment.type"],
    ["zona de otra tienda", { fulfillment: { type: "delivery", zoneId: "zn_tn_los-olivos", address: "Av. 1" } }, "fulfillment.zoneId"],
    ["delivery sin dirección", { fulfillment: { type: "delivery", zoneId: SURCO } }, "fulfillment.address"],
    ["sin fecha", { deliveryDate: undefined }, "deliveryDate"],
    ["fecha con formato inválido", { deliveryDate: "02/11/2026" }, "deliveryDate"],
    ["fecha en el pasado", { deliveryDate: "2026-10-30" }, "deliveryDate"],
    ["fecha sin anticipación", { deliveryDate: "2026-10-31" }, "deliveryDate"],
    ["carrito vacío", { items: [] }, "items"],
    ["cantidad 0", { items: [{ variantId: MEDIANA, quantity: 0, customValues: {} }] }, "items.0.quantity"],
    ["cantidad 100", { items: [{ variantId: MEDIANA, quantity: 100, customValues: {} }] }, "items.0.quantity"],
    ["cantidad con decimales", { items: [{ variantId: MEDIANA, quantity: 1.5, customValues: {} }] }, "items.0.quantity"],
    ["variante que no existe", { items: [{ variantId: "va_no_existe", quantity: 1, customValues: {} }] }, "items.0.variantId"],
    ["variante de otra tienda", { items: [{ variantId: "va_fl_cargador-rapido", quantity: 1, customValues: {} }] }, "items.0.variantId"],
    ["campo extra muy largo", { items: [{ variantId: MEDIANA, quantity: 1, customValues: { Dedicatoria: "x".repeat(31) } }] }, "items.0.customValues.Dedicatoria"],
    ["campo extra que no existe", { items: [{ variantId: MEDIANA, quantity: 1, customValues: { Grabado: "Hola" } }] }, "items.0.customValues.Grabado"],
  ] as [string, Partial<CreateOrderInput>, string][])("rechaza %s", (_name, overrides, field) => {
    expect(expectFields(createOrder(db, input(overrides), NOW))).toHaveProperty([field]);
  });

  it("junta todos los errores en una sola respuesta", () => {
    const fields = expectFields(createOrder(db, input({ customer: { name: "", phone: "1" }, paymentMethod: "transfer" }), NOW));
    expect(Object.keys(fields).sort()).toEqual(["customer.name", "customer.phone", "paymentMethod"]);
  });

  it("rechaza fecha de entrega si la función está apagada", () => {
    const fields = expectFields(
      createOrder(
        db,
        {
          storeSlug: "tallernorte",
          items: [{ variantId: "va_tn_gorra", quantity: 1, customValues: {} }],
          customer: { name: "Paula", phone: "987111222" },
          fulfillment: { type: "delivery", zoneId: "zn_tn_los-olivos", address: "Av. 1" },
          deliveryDate: "2026-11-05",
          paymentMethod: "yape",
        },
        NOW,
      ),
    );
    expect(fields).toHaveProperty(["deliveryDate"]);
  });

  it("rechaza un día sin horario de atención", () => {
    store("dulcesdeana").businessHours.mon = null;
    expect(expectFields(createOrder(db, input({ deliveryDate: "2026-11-02" }), NOW))).toHaveProperty(["deliveryDate"]);
  });

  it("rechaza zonas desactivadas y delivery si la función está apagada", () => {
    const tn = {
      storeSlug: "tallernorte",
      items: [{ variantId: "va_tn_gorra", quantity: 1, customValues: {} }],
      customer: { name: "Paula", phone: "987111222" },
      paymentMethod: "yape" as const,
    };
    expect(expectFields(createOrder(db, { ...tn, fulfillment: { type: "delivery", zoneId: "zn_tn_independencia", address: "Av. 1" } }, NOW))).toHaveProperty(["fulfillment.zoneId"]);
    store("tallernorte").features.deliveryZones = false;
    expect(expectFields(createOrder(db, { ...tn, fulfillment: { type: "delivery", zoneId: "zn_tn_los-olivos", address: "Av. 1" } }, NOW))).toHaveProperty(["fulfillment.type"]);
  });

  it("exige los campos extra obligatorios", () => {
    const fields = expectFields(
      createOrder(
        db,
        {
          storeSlug: "fundalab",
          items: [{ variantId: "va_fl_funda-personalizada_iphone-15_negro", quantity: 1, customValues: { "Nombre para personalizar": " " } }],
          customer: { name: "Paula", phone: "987111222" },
          fulfillment: { type: "pickup" },
          paymentMethod: "yape",
        },
        NOW,
      ),
    );
    expect(fields).toHaveProperty(["items.0.customValues.Nombre para personalizar"]);
  });

  it("rechaza variantes desactivadas y productos ocultos", () => {
    const base = {
      storeSlug: "tallernorte",
      customer: { name: "Paula", phone: "987111222" },
      fulfillment: { type: "delivery" as const, zoneId: "zn_tn_los-olivos", address: "Av. 1" },
      paymentMethod: "yape" as const,
    };
    expect(expectFields(createOrder(db, { ...base, items: [{ variantId: "va_tn_jogger_gris_l", quantity: 1, customValues: {} }] }, NOW))).toHaveProperty(["items.0.variantId"]);
    expect(expectFields(createOrder(db, { ...base, items: [{ variantId: "va_tn_short-cargo_30", quantity: 1, customValues: {} }] }, NOW))).toHaveProperty(["items.0.variantId"]);
  });

  it("rechaza un cuerpo que no es un objeto", () => {
    expect(createOrder(db, "hola", NOW)).toMatchObject({ ok: false, error: "validation" });
  });

  it("tienda que no existe: 404", () => {
    expect(() => createOrder(db, input({ storeSlug: "no-existe" }), NOW)).toThrow(MockApiError);
  });
});

describe("createOrder · límite por teléfono", () => {
  it(`permite ${ORDERS_PER_HOUR_PER_PHONE} pedidos por hora y rechaza el siguiente`, () => {
    // Producto por encargo: no gasta stock, así solo cuenta el límite
    const order = () => input({ items: [{ variantId: TRES_LECHES, quantity: 1, customValues: {} }] });
    for (let i = 0; i < ORDERS_PER_HOUR_PER_PHONE; i++) {
      expectOk(createOrder(db, order(), new Date(NOW.getTime() + i * 60_000)));
    }
    expect(createOrder(db, order(), new Date(NOW.getTime() + 10 * 60_000))).toEqual({ ok: false, error: "rate_limited" });
    // Pasada la hora vuelve a aceptar
    expectOk(createOrder(db, order(), new Date(NOW.getTime() + HOUR + 60_000)));
  });
});

describe("estados del pedido", () => {
  const create = (variantId = MEDIANA, quantity = 1): OrderRecord => {
    const result = expectOk(createOrder(db, input({ items: [{ variantId, quantity, customValues: {} }] }), NOW));
    return db.orders.find((o) => o.publicToken === result.publicToken)!;
  };

  it("solo permite las transiciones de la sección 7", () => {
    expect(canTransition("new", "paid")).toBe(true);
    expect(canTransition("paid", "preparing")).toBe(true);
    expect(canTransition("preparing", "delivered")).toBe(true);
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("paid", "cancelled")).toBe(true);
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("new", "expired")).toBe(true);
    expect(canTransition("new", "preparing")).toBe(false);
    expect(canTransition("paid", "delivered")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
    expect(canTransition("expired", "paid")).toBe(false);
    expect(canTransition("paid", "expired")).toBe(false);
  });

  it("recorre de Nuevo a Entregado y el stock cambia según la sección 7", () => {
    const { onHand, reserved } = stock(MEDIANA);
    const order = create(MEDIANA, 2);
    expect(stock(MEDIANA)).toMatchObject({ onHand, reserved: reserved + 2 });

    confirmPayment(db, order, "Ana Torres", NOW);
    expect(order.status).toBe("paid");
    expect(order.paidAt).toBe("2026-10-31T15:00:00Z");
    expect(stock(MEDIANA)).toMatchObject({ onHand: onHand - 2, reserved });
    expect(db.movements.at(-1)).toMatchObject({ type: "sale", quantity: -2, createdBy: "Ana Torres" });

    startPreparing(order);
    expect(order.status).toBe("preparing");
    markDelivered(order, NOW);
    expect(order.status).toBe("delivered");
    expect(order.deliveredAt).not.toBeNull();
    expect(stock(MEDIANA)).toMatchObject({ onHand: onHand - 2, reserved });
  });

  it("rechaza transiciones no permitidas con 409", () => {
    const order = create();
    expect(() => startPreparing(order)).toThrow(expect.objectContaining({ status: 409, code: "invalid_status" }));
    expect(() => markDelivered(order)).toThrow(MockApiError);
    confirmPayment(db, order, "Ana", NOW);
    expect(() => confirmPayment(db, order, "Ana", NOW)).toThrow(MockApiError);
  });

  it("cancelar un pedido nuevo libera la reserva", () => {
    const before = { ...stock(MEDIANA) };
    const order = create(MEDIANA, 1);
    cancelOrder(db, order, "Ana", NOW);
    expect(order.status).toBe("cancelled");
    expect(order.cancelledAt).not.toBeNull();
    expect(stock(MEDIANA)).toMatchObject({ onHand: before.onHand, reserved: before.reserved });
    expect(db.movements.at(-1)).toMatchObject({ type: "release", quantity: 1, reason: "cancelacion" });
  });

  it.each(["paid", "preparing"] as const)("cancelar un pedido %s devuelve el stock (in, cancelacion)", (status) => {
    const before = { ...stock(MEDIANA) };
    const order = create(MEDIANA, 1);
    confirmPayment(db, order, "Ana", NOW);
    if (status === "preparing") startPreparing(order);
    cancelOrder(db, order, "Ana", NOW);
    expect(stock(MEDIANA)).toMatchObject({ onHand: before.onHand, reserved: before.reserved });
    expect(db.movements.at(-1)).toMatchObject({ type: "in", quantity: 1, reason: "cancelacion" });
  });

  it("no se puede cancelar un pedido entregado", () => {
    const order = create();
    confirmPayment(db, order, "Ana", NOW);
    startPreparing(order);
    markDelivered(order, NOW);
    expect(() => cancelOrder(db, order, "Ana", NOW)).toThrow(MockApiError);
  });

  it("los pedidos por encargo cambian de estado sin mover stock", () => {
    const order = create(TRES_LECHES, 1);
    const movements = db.movements.length;
    confirmPayment(db, order, "Ana", NOW);
    cancelOrder(db, order, "Ana", NOW);
    expect(db.movements.length).toBe(movements);
  });
});

describe("expireOrders", () => {
  it("vence los pedidos nuevos cuya reserva pasó y libera el stock", () => {
    const result = expectOk(createOrder(db, input({ items: [{ variantId: GRANDE, quantity: 1, customValues: {} }] }), NOW));
    expect(availableOf(stock(GRANDE))).toBe(0);

    // A las 23 horas sigue vigente (pueden vencer otros pedidos de los datos de prueba, no este)
    const early = expireOrders(db, new Date(NOW.getTime() + 23 * HOUR));
    expect(early.map((o) => o.publicToken)).not.toContain(result.publicToken);
    expect(availableOf(stock(GRANDE))).toBe(0);

    const expired = expireOrders(db, new Date(NOW.getTime() + 24 * HOUR));
    expect(expired.map((o) => o.publicToken)).toContain(result.publicToken);
    expect(expired.every((o) => o.status === "expired")).toBe(true);
    expect(availableOf(stock(GRANDE))).toBe(1);
    expect(db.movements.at(-1)).toMatchObject({ type: "release", createdBy: null });
  });

  it("no toca pedidos pagados", () => {
    const result = expectOk(createOrder(db, input(), NOW));
    const order = db.orders.find((o) => o.publicToken === result.publicToken)!;
    confirmPayment(db, order, "Ana", NOW);
    expireOrders(db, new Date(NOW.getTime() + 48 * HOUR));
    expect(order.status).toBe("paid");
  });

  it("es idempotente", () => {
    expireOrders(db, new Date(NOW.getTime() + 48 * HOUR));
    const movements = db.movements.length;
    expect(expireOrders(db, new Date(NOW.getTime() + 49 * HOUR))).toHaveLength(0);
    expect(db.movements.length).toBe(movements);
  });
});

describe("getPublicOrder", () => {
  it("encuentra el pedido por tienda y token", () => {
    const order = expectOk(createOrder(db, input(), NOW));
    expect(getPublicOrder(db, "dulcesdeana", order.publicToken)).toEqual(order);
  });

  it("no lo encuentra con el token en otra tienda", () => {
    const order = expectOk(createOrder(db, input(), NOW));
    expect(() => getPublicOrder(db, "fundalab", order.publicToken)).toThrow(expect.objectContaining({ status: 404 }));
  });
});
