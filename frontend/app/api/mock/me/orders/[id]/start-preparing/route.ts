import { mockRoute } from "@/mocks/http";
import { findOrder, startPreparing, toOrder } from "@/mocks/logic/orders";
import { getSessionStore } from "@/mocks/logic/session";

/** POST /me/orders/:id/start-preparing → Order (pagado → preparando) */
export const POST = mockRoute<RouteContext<"/api/mock/me/orders/[id]/start-preparing">>(async (request, ctx, { db }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(toOrder(startPreparing(findOrder(db, store.id, id))));
});
