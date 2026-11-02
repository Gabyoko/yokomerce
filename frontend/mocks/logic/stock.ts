import type { StockMovementType } from "@/shared/types";

import type { MockDb, OrderRecord, StockItemRecord, StockMovementRecord } from "../types";

/** Se rompió una regla de stock (SPEC.md, sección 7). */
export class StockRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockRuleError";
  }
}

export function availableOf(item: Pick<StockItemRecord, "onHand" | "reserved">): number {
  return item.onHand - item.reserved;
}

/**
 * Aplica un movimiento al stock de una variante y devuelve el stock nuevo (no modifica el original).
 *
 * `amount` es siempre positivo: unidades que se mueven. En `adjust` es el total exacto nuevo.
 * `signedQuantity` es lo que se guarda en StockMovement.quantity: positivo si aumenta lo
 * disponible o el total, negativo si lo disminuye.
 *
 * - reserve: reserved += q        (crear pedido)
 * - release: reserved -= q        (cancelar o vencer un pedido nuevo)
 * - sale:    onHand -= q, reserved -= q  (confirmar pago)
 * - in:      onHand += q          (ingreso, o devolución al cancelar un pedido pagado)
 * - out:     onHand -= q          (merma, venta en tienda, regalo...)
 * - adjust:  onHand = q           (fijar el total exacto)
 */
export function applyStockMovement(
  item: StockItemRecord,
  type: StockMovementType,
  amount: number,
): { item: StockItemRecord; signedQuantity: number } {
  if (!Number.isInteger(amount) || amount < 0 || (amount === 0 && type !== "adjust")) {
    throw new StockRuleError(`Cantidad inválida para ${type}: ${amount}`);
  }

  let { onHand, reserved } = item;
  let signedQuantity: number;

  switch (type) {
    case "reserve":
      if (availableOf(item) < amount) {
        throw new StockRuleError(`No alcanza el stock: hay ${availableOf(item)} disponibles y se piden ${amount}`);
      }
      reserved += amount;
      signedQuantity = -amount;
      break;
    case "release":
      if (reserved < amount) throw new StockRuleError(`No se pueden liberar ${amount}: hay ${reserved} reservados`);
      reserved -= amount;
      signedQuantity = amount;
      break;
    case "sale":
      if (reserved < amount) throw new StockRuleError(`No se pueden vender ${amount}: hay ${reserved} reservados`);
      onHand -= amount;
      reserved -= amount;
      signedQuantity = -amount;
      break;
    case "in":
      onHand += amount;
      signedQuantity = amount;
      break;
    case "out":
      if (availableOf(item) < amount) {
        throw new StockRuleError(`No se pueden sacar ${amount}: hay ${availableOf(item)} disponibles`);
      }
      onHand -= amount;
      signedQuantity = -amount;
      break;
    case "adjust":
      if (amount < reserved) {
        throw new StockRuleError(`El total no puede ser menor que lo reservado (${reserved})`);
      }
      signedQuantity = amount - onHand;
      onHand = amount;
      break;
  }

  return { item: { ...item, onHand, reserved }, signedQuantity };
}

export function getStockItem(db: MockDb, variantId: string): StockItemRecord {
  const item = db.stockItems.find((s) => s.variantId === variantId);
  if (!item) throw new StockRuleError(`La variante ${variantId} no tiene stock`);
  return item;
}

type RecordMovementInput = {
  variantId: string;
  type: StockMovementType;
  amount: number;
  reason: string | null;
  /** null = automático (reserva al crear el pedido, vencimiento). */
  createdBy: string | null;
  order?: OrderRecord | null;
  now: Date;
};

/**
 * Aplica un movimiento al stock guardado y lo registra en el historial.
 * Todo cambio de stock pasa por aquí (SPEC.md, sección 7).
 */
export function recordStockMovement(db: MockDb, input: RecordMovementInput): StockMovementRecord {
  const current = getStockItem(db, input.variantId);
  const { item, signedQuantity } = applyStockMovement(current, input.type, input.amount);
  Object.assign(current, item);

  const movement: StockMovementRecord = {
    id: `mv_${crypto.randomUUID()}`,
    storeId: current.storeId,
    variantId: input.variantId,
    orderId: input.order?.id ?? null,
    orderNumber: input.order?.number ?? null,
    type: input.type,
    quantity: signedQuantity,
    reason: input.reason,
    createdBy: input.createdBy,
    createdAt: input.now.toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  db.movements.push(movement);
  return movement;
}
