import { mockRoute } from "@/mocks/http";
import { listStockMovements } from "@/mocks/logic/inventory";
import { getSessionStore } from "@/mocks/logic/session";

/** GET /me/variants/:id/movements → StockMovement[] (más recientes primero) */
export const GET = mockRoute<RouteContext<"/api/mock/me/variants/[id]/movements">>(async (request, ctx, { db, now }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(listStockMovements(db, store, id, now));
});
