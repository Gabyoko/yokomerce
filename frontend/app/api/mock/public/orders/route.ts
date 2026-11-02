import { mockRoute, readJson } from "@/mocks/http";
import { createOrder } from "@/mocks/logic/orders";
import type { CreateOrderResult } from "@/shared/types";

type Failure = Extract<CreateOrderResult, { ok: false }>;

const FAILURES: Record<Failure["error"], { status: number; message: string }> = {
  validation: { status: 400, message: "Revisa los datos del pedido." },
  out_of_stock: { status: 409, message: "Algunos productos ya no tienen stock suficiente." },
  rate_limited: { status: 429, message: "Hiciste varios pedidos seguidos. Espera un rato e inténtalo otra vez." },
};

/**
 * POST /public/orders → CreateOrderResult
 * Éxito: 201 { ok: true, order }.
 * Error: código HTTP del error y { ok: false, error, message, ...datos del error } (items o fields).
 */
export const POST = mockRoute(async (request, _ctx, { db, now }) => {
  const result = createOrder(db, await readJson(request), now);
  if (result.ok) return Response.json(result, { status: 201 });

  const { status, message } = FAILURES[result.error];
  return Response.json({ ...result, message }, { status });
});
