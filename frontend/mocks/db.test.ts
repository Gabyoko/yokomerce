import { beforeEach, describe, expect, it } from "vitest";

import { isValidPeruPhone } from "@/shared/lib/phone";

import { getDb, resetDb } from "./db";
import { applyStockMovement, availableOf } from "./logic/stock";
import type { MockDb, StockItemRecord } from "./types";

const NOW = new Date("2026-10-31T15:00:00Z"); // sábado 31, 10:00 a. m. en Lima
const DAY = 24 * 60 * 60_000;

let db: MockDb;
beforeEach(() => {
  db = resetDb(NOW);
});

const storeBySlug = (slug: string) => db.stores.find((s) => s.slug === slug)!;
const productsOf = (slug: string) => db.products.filter((p) => p.storeId === storeBySlug(slug).id);
const variantsOf = (productId: string) => db.variants.filter((v) => v.productId === productId);
const stockOf = (variantId: string) => db.stockItems.find((s) => s.variantId === variantId)!;
const productByName = (slug: string, name: string) => productsOf(slug).find((p) => p.name === name)!;

describe("globalThis", () => {
  it("getDb devuelve siempre la misma instancia", () => {
    expect(getDb()).toBe(getDb());
    expect(getDb()).toBe(db);
  });

  it("resetDb vuelve a los datos iniciales", () => {
    db.orders.length = 0;
    expect(resetDb(NOW).orders.length).toBeGreaterThan(0);
  });

  it("los datos se arman sin errores a cualquier hora y día en que arranque el servidor", () => {
    for (let hour = 0; hour < 7 * 24; hour += 1) {
      expect(() => resetDb(new Date(NOW.getTime() + hour * 60 * 60_000 + 17 * 60_000))).not.toThrow();
    }
  });
});

describe("las tres tiendas (SPEC.md, sección 6)", () => {
  it("existen con sus slugs", () => {
    expect(db.stores.map((s) => s.slug)).toEqual(["dulcesdeana", "tallernorte", "fundalab"]);
  });

  it.each(["dulcesdeana", "tallernorte", "fundalab"])("%s tiene de 6 a 10 productos y de 8 a 15 pedidos", (slug) => {
    const store = storeBySlug(slug);
    expect(productsOf(slug).length).toBeGreaterThanOrEqual(6);
    expect(productsOf(slug).length).toBeLessThanOrEqual(10);
    const orders = db.orders.filter((o) => o.storeId === store.id);
    expect(orders.length).toBeGreaterThanOrEqual(8);
    expect(orders.length).toBeLessThanOrEqual(15);
  });

  it("cada tienda tiene pedidos en distintos estados", () => {
    for (const store of db.stores) {
      const statuses = new Set(db.orders.filter((o) => o.storeId === store.id).map((o) => o.status));
      expect(statuses).toEqual(new Set(["new", "paid", "preparing", "delivered", "cancelled", "expired"]));
    }
  });

  it("Dulces de Ana: fecha de entrega, 1 día de anticipación, encargos, zonas y recojo", () => {
    const store = storeBySlug("dulcesdeana");
    expect(store.features).toEqual({
      deliveryDate: true,
      leadTimeDays: 1,
      madeToOrder: true,
      sizeGuide: false,
      deliveryZones: true,
      pickup: true,
      shipping: false,
    });
    expect(store.paymentMethods).toEqual(["yape", "plin", "cash"]);
    const zones = db.zones.filter((z) => z.storeId === store.id).map((z) => [z.name, z.priceCents]);
    expect(zones).toEqual([
      ["Santiago de Surco", 800],
      ["Miraflores", 1000],
      ["Barranco", 1000],
    ]);
  });

  it("Dulces de Ana: productos de la SPEC", () => {
    const torta = productByName("dulcesdeana", "Torta de chocolate");
    expect(torta.options.map((o) => o.name)).toEqual(["Tamaño"]);
    expect(torta.customFields.map((f) => f.label)).toEqual(["Dedicatoria"]);
    const [mediana, grande] = variantsOf(torta.id);
    expect([mediana?.label, mediana?.priceCents]).toEqual(["Mediana", 4500]);
    expect([grande?.label, grande?.priceCents]).toEqual(["Grande", 7000]);
    expect(availableOf(stockOf(grande!.id))).toBe(1);

    const cheesecake = variantsOf(productByName("dulcesdeana", "Cheesecake de maracuyá").id)[0]!;
    expect(availableOf(stockOf(cheesecake.id))).toBe(2);
    expect(availableOf(stockOf(cheesecake.id))).toBeLessThanOrEqual(stockOf(cheesecake.id).lowStockThreshold!);

    const keke = variantsOf(productByName("dulcesdeana", "Keke de naranja").id)[0]!;
    expect(availableOf(stockOf(keke.id))).toBe(0);

    expect(productByName("dulcesdeana", "Torta tres leches").madeToOrder).toBe(true);
  });

  it("Taller Norte: polo con 12 combinaciones y 3 agotadas", () => {
    const store = storeBySlug("tallernorte");
    expect(store.features.sizeGuide).toBe(true);
    expect(store.features.deliveryDate).toBe(false);
    expect(store.shippingFeeCents).toBe(1500);

    const polo = productByName("tallernorte", "Polo oversize");
    expect(polo.options.map((o) => o.name).sort()).toEqual(["Color", "Talla"]);
    const variants = variantsOf(polo.id);
    expect(variants).toHaveLength(12);
    expect(variants.filter((v) => availableOf(stockOf(v.id)) === 0)).toHaveLength(3);
    expect(polo.sizeGuideUrl).not.toBeNull();
  });

  it("Funda Lab: envío a coordinar, recojo, sin zonas ni fecha", () => {
    const store = storeBySlug("fundalab");
    expect(store.shippingFeeCents).toBeNull();
    expect(store.features).toMatchObject({ shipping: true, pickup: true, deliveryZones: false, deliveryDate: false });
    expect(db.zones.filter((z) => z.storeId === store.id)).toHaveLength(0);

    const personalizada = productByName("fundalab", "Funda personalizada");
    expect(personalizada.customFields).toEqual([
      expect.objectContaining({ label: "Nombre para personalizar", required: true, maxLength: 20 }),
    ]);
    expect(variantsOf(productByName("fundalab", "Cargador rápido 20 W").id)).toEqual([
      expect.objectContaining({ label: "", optionValueIds: [] }),
    ]);
  });

  it("hay al menos una variante con exactamente 1 disponible", () => {
    expect(db.stockItems.some((s) => availableOf(s) === 1)).toBe(true);
  });
});

describe("productos y variantes", () => {
  it("los ids son únicos", () => {
    for (const list of [db.stores, db.zones, db.categories, db.products, db.variants, db.orders, db.movements]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("los productos sin opciones tienen exactamente una variante por defecto", () => {
    for (const product of db.products.filter((p) => p.options.length === 0)) {
      expect(variantsOf(product.id)).toEqual([expect.objectContaining({ label: "", optionValueIds: [] })]);
    }
  });

  it("las variantes apuntan a valores de sus propias opciones", () => {
    for (const variant of db.variants) {
      const product = db.products.find((p) => p.id === variant.productId)!;
      const valueIds = product.options.flatMap((o) => o.values.map((v) => v.id));
      expect(variant.optionValueIds).toHaveLength(product.options.length);
      for (const id of variant.optionValueIds) expect(valueIds).toContain(id);
    }
  });

  it("cada variante tiene su stock y los productos por encargo no tienen stock", () => {
    for (const variant of db.variants) {
      const stock = stockOf(variant.id);
      expect(stock).toBeDefined();
      const product = db.products.find((p) => p.id === variant.productId)!;
      if (product.madeToOrder) expect(stock).toMatchObject({ onHand: 0, reserved: 0 });
    }
  });

  it("las funciones apagadas no aparecen en los productos", () => {
    for (const product of db.products) {
      const store = db.stores.find((s) => s.id === product.storeId)!;
      if (!store.features.madeToOrder) expect(product.madeToOrder).toBe(false);
      if (!store.features.sizeGuide) expect(product.sizeGuideUrl).toBeNull();
    }
  });
});

describe("pedidos", () => {
  it("son de los últimos 7 días", () => {
    for (const order of db.orders) {
      const age = NOW.getTime() - new Date(order.createdAt).getTime();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(7 * DAY);
    }
  });

  it("los totales cuadran con las líneas y la entrega", () => {
    for (const order of db.orders) {
      for (const item of order.items) expect(item.lineTotalCents).toBe(item.unitPriceCents * item.quantity);
      expect(order.subtotalCents).toBe(order.items.reduce((sum, item) => sum + item.lineTotalCents, 0));
      expect(order.totalCents).toBe(order.subtotalCents + (order.deliveryFeeCents ?? 0));
    }
  });

  it("el precio de cada línea es el de la variante", () => {
    for (const order of db.orders) {
      for (const item of order.items) {
        expect(item.unitPriceCents).toBe(db.variants.find((v) => v.id === item.variantId)!.priceCents);
      }
    }
  });

  it("los números son únicos por tienda y nextOrderNumber es el siguiente", () => {
    for (const store of db.stores) {
      const numbers = db.orders.filter((o) => o.storeId === store.id).map((o) => o.number);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(store.nextOrderNumber).toBe(Math.max(...numbers) + 1);
    }
  });

  it("los pedidos nuevos tienen la reserva vigente y los vencidos no", () => {
    for (const order of db.orders) {
      const reservedUntil = new Date(order.reservedUntil).getTime();
      if (order.status === "new") expect(reservedUntil).toBeGreaterThan(NOW.getTime());
      if (order.status === "expired") expect(reservedUntil).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it("las fechas de cada estado están presentes solo cuando corresponden", () => {
    for (const order of db.orders) {
      expect(order.deliveredAt !== null).toBe(order.status === "delivered");
      expect(order.cancelledAt !== null).toBe(order.status === "cancelled");
      if (["paid", "preparing", "delivered"].includes(order.status)) expect(order.paidAt).not.toBeNull();
      if (["new", "expired"].includes(order.status)) expect(order.paidAt).toBeNull();
    }
  });

  it("respetan las funciones de la tienda", () => {
    for (const order of db.orders) {
      const store = db.stores.find((s) => s.id === order.storeId)!;
      expect(order.deliveryDate !== null).toBe(store.features.deliveryDate);
      if (order.fulfillment.type === "delivery") expect(store.features.deliveryZones).toBe(true);
      if (order.fulfillment.type === "pickup") expect(store.features.pickup).toBe(true);
      if (order.fulfillment.type === "shipping") expect(store.features.shipping).toBe(true);
      expect(store.paymentMethods).toContain(order.paymentMethod);
    }
  });

  it("los celulares son peruanos válidos", () => {
    for (const order of db.orders) expect(isValidPeruPhone(order.customer.phone)).toBe(true);
    for (const store of db.stores) expect(isValidPeruPhone(store.whatsapp)).toBe(true);
  });

  it("las fechas usan formato ISO", () => {
    for (const order of db.orders) {
      expect(order.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      if (order.deliveryDate) expect(order.deliveryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("María López (#0042) coincide con el diseño: S/ 116.00", () => {
    const maria = db.orders.find((o) => o.customer.name === "María López")!;
    expect(maria.number).toBe(42);
    expect(maria.status).toBe("new");
    expect(maria.totalCents).toBe(11600);
  });
});

describe("stock", () => {
  it("cumple las invariantes: nada negativo y reserved <= onHand", () => {
    for (const item of db.stockItems) {
      expect(item.onHand).toBeGreaterThanOrEqual(0);
      expect(item.reserved).toBeGreaterThanOrEqual(0);
      expect(item.reserved).toBeLessThanOrEqual(item.onHand);
    }
  });

  it("lo reservado es exactamente lo que piden los pedidos nuevos", () => {
    for (const item of db.stockItems) {
      const reservedByOrders = db.orders
        .filter((o) => o.status === "new")
        .flatMap((o) => o.items)
        .filter((i) => i.variantId === item.variantId && i.tracksStock)
        .reduce((sum, i) => sum + i.quantity, 0);
      expect(item.reserved).toBe(reservedByOrders);
    }
  });

  it("el historial de movimientos reconstruye el stock actual", () => {
    for (const item of db.stockItems) {
      const movements = db.movements
        .filter((m) => m.variantId === item.variantId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      let rebuilt: StockItemRecord = { ...item, onHand: 0, reserved: 0 };
      for (const movement of movements) {
        const amount = movement.type === "adjust" ? rebuilt.onHand + movement.quantity : Math.abs(movement.quantity);
        rebuilt = applyStockMovement(rebuilt, movement.type, amount).item;
      }
      expect({ onHand: rebuilt.onHand, reserved: rebuilt.reserved }).toEqual({
        onHand: item.onHand,
        reserved: item.reserved,
      });
    }
  });

  it("los pedidos generan sus movimientos", () => {
    const cancelledAfterPaying = db.orders.find((o) => o.status === "cancelled" && o.paidAt !== null)!;
    const types = db.movements.filter((m) => m.orderId === cancelledAfterPaying.id).map((m) => [m.type, m.reason]);
    expect(types).toEqual([
      ["reserve", null],
      ["sale", null],
      ["in", "cancelacion"],
    ]);

    const expired = db.orders.find((o) => o.status === "expired")!;
    expect(db.movements.filter((m) => m.orderId === expired.id).map((m) => m.type)).toEqual(["reserve", "release"]);
  });

  it("los productos por encargo no generan movimientos", () => {
    const madeToOrderVariants = db.variants.filter(
      (v) => db.products.find((p) => p.id === v.productId)!.madeToOrder,
    );
    for (const variant of madeToOrderVariants) {
      expect(db.movements.filter((m) => m.variantId === variant.id)).toHaveLength(0);
    }
  });
});
