import { connection } from "next/server";

import { getDb } from "./db";
import { MockApiError } from "./logic/errors";
import { expireOrders } from "./logic/orders";
import type { MockDb } from "./types";

/** Retraso de cada respuesta para ver los estados de carga (SPEC.md, sección 2). */
const DELAY_MS = 300;

type HandlerContext = { db: MockDb; now: Date };

/**
 * Envuelve un route handler de app/api/mock/:
 * espera 300 ms, vence las reservas pasadas y convierte los errores en { error, message }.
 */
export function mockRoute<Ctx>(handler: (request: Request, ctx: Ctx, mock: HandlerContext) => Promise<Response> | Response) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    // La base vive en memoria: sin esto, Next podría prerenderizar la respuesta al compilar
    await connection();
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

    const db = getDb();
    const now = new Date();
    try {
      expireOrders(db, now);
      return await handler(request, ctx, { db, now });
    } catch (error) {
      if (error instanceof MockApiError) {
        return Response.json({ error: error.code, message: error.message, ...error.extra }, { status: error.status });
      }
      console.error("[api de prueba]", error);
      return Response.json({ error: "internal", message: "Algo salió mal. Inténtalo otra vez." }, { status: 500 });
    }
  };
}

/** Lee el cuerpo JSON; si no es JSON válido responde 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new MockApiError(400, "validation", "El cuerpo de la petición no es JSON válido.");
  }
}
