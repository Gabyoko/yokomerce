import { canUse } from "@/features/plans";
import type { StockAdjustmentInput, StockAdjustmentResult, StockMovement } from "@/shared/types";

import type { MockDb, StockMovementRecord, StoreRecord } from "../types";
import { getVariantAdmin, isMadeToOrder } from "./catalog";
import { badRequest, conflict, MockApiError, notFound } from "./errors";
import { applyStockMovement, getStockItem, recordStockMovement, StockRuleError } from "./stock";

const REASON_MAX = 60;
const MAX_STOCK = 99_999;

export function toStockMovement(record: StockMovementRecord): StockMovement {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { storeId, orderId, ...movement } = record;
  return movement;
}

/** Variante de la tienda del dueño. */
function findOwnVariant(db: MockDb, storeId: string, variantId: string) {
  const variant = db.variants.find((v) => v.id === variantId && v.storeId === storeId);
  if (!variant) throw notFound("No encontramos esta variante.");
  const product = db.products.find((p) => p.id === variant.productId);
  const store = db.stores.find((s) => s.id === storeId);
  if (!product || !store) throw notFound("No encontramos esta variante.");
  return { variant, product, store };
}

/**
 * POST /me/variants/:id/adjustments
 * Ajuste manual (SPEC.md, sección 7): in suma, out resta, adjust fija el total.
 * Nunca puede dejar el total por debajo de lo reservado.
 */
export function adjustStock(
  db: MockDb,
  storeId: string,
  variantId: string,
  input: unknown,
  actor: string,
  now: Date = new Date(),
): StockAdjustmentResult {
  const { product, store } = findOwnVariant(db, storeId, variantId);
  if (isMadeToOrder(product, store)) {
    throw conflict("made_to_order", "Este producto es por encargo y no lleva control de stock.");
  }

  const { type, quantity, reason } = (typeof input === "object" && input !== null ? input : {}) as Partial<StockAdjustmentInput>;
  const fields: Record<string, string> = {};
  if (type !== "in" && type !== "out" && type !== "adjust") fields.type = "Elige si es ingreso, salida o ajuste.";
  const minimum = type === "adjust" ? 0 : 1;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < minimum || quantity > MAX_STOCK) {
    fields.quantity = type === "adjust" ? "Escribe el total exacto (0 o más)." : "Escribe una cantidad mayor a 0.";
  }
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (!cleanReason || cleanReason.length > REASON_MAX) fields.reason = "Elige o escribe un motivo.";
  if (Object.keys(fields).length > 0) throw badRequest("Revisa los datos del ajuste.", { fields });

  // Revisa antes de guardar para responder con un mensaje claro
  const stock = getStockItem(db, variantId);
  try {
    applyStockMovement(stock, type as StockAdjustmentInput["type"], quantity as number);
  } catch (error) {
    if (!(error instanceof StockRuleError)) throw error;
    const available = stock.onHand - stock.reserved;
    throw conflict(
      "stock_conflict",
      type === "out"
        ? `Solo puedes sacar ${available}: el resto está reservado en pedidos nuevos o no hay más.`
        : `Hay ${stock.reserved} ${stock.reserved === 1 ? "unidad reservada" : "unidades reservadas"} en pedidos nuevos: el total no puede quedar por debajo.`,
    );
  }

  const movement = recordStockMovement(db, {
    variantId,
    type: type as StockAdjustmentInput["type"],
    amount: quantity as number,
    reason: cleanReason,
    createdBy: actor,
    now,
  });
  return { movement: toStockMovement(movement), variant: getVariantAdmin(db, variantId) };
}

/** GET /me/variants/:id/movements — más recientes primero. Es una función del plan Pro. */
export function listStockMovements(db: MockDb, store: StoreRecord, variantId: string, now: Date = new Date()): StockMovement[] {
  findOwnVariant(db, store.id, variantId);
  if (!canUse(store, "stockHistory", now)) {
    throw new MockApiError(403, "plan_required", "El historial de stock es parte del plan Pro.");
  }
  // db.movements se guarda en orden cronológico: basta con invertirlo
  return db.movements
    .filter((m) => m.variantId === variantId)
    .reverse()
    .map(toStockMovement);
}
