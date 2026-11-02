import { ApiError, apiFetch } from "@/shared/api/client";
import type { CreateOrderInput, CreateOrderResult, PublicOrder } from "@/shared/types";

type OrderFailure = Extract<CreateOrderResult, { ok: false }>;

const ORDER_FAILURES: OrderFailure["error"][] = ["out_of_stock", "validation", "rate_limited"];

/**
 * POST /public/orders
 * Los errores esperados (sin stock, datos inválidos, demasiados pedidos) llegan con su código HTTP
 * y se devuelven como { ok: false, ... } para que el checkout los muestre. Otros errores se lanzan.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  try {
    return await apiFetch<CreateOrderResult>("/public/orders", { method: "POST", body: JSON.stringify(input) });
  } catch (error) {
    if (error instanceof ApiError && ORDER_FAILURES.includes(error.code as OrderFailure["error"])) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { message, ...failure } = error.body;
      return { ...failure, ok: false } as OrderFailure;
    }
    throw error;
  }
}

/** GET /public/stores/:slug/orders/:token — pedido listo y vista previa del mensaje. */
export function getPublicOrder(slug: string, token: string): Promise<PublicOrder> {
  return apiFetch<PublicOrder>(`/public/stores/${encodeURIComponent(slug)}/orders/${encodeURIComponent(token)}`);
}
