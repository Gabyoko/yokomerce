import { mockRoute, readJson } from "@/mocks/http";
import { adjustStock } from "@/mocks/logic/inventory";
import { getSessionStore } from "@/mocks/logic/session";

/** POST /me/variants/:id/adjustments → StockAdjustmentResult (201) */
export const POST = mockRoute<RouteContext<"/api/mock/me/variants/[id]/adjustments">>(async (request, ctx, { db, now }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(adjustStock(db, store.id, id, await readJson(request), store.ownerName, now), { status: 201 });
});
