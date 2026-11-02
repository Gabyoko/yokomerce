import { mockRoute } from "@/mocks/http";
import { findOrder, markDelivered, toOrder } from "@/mocks/logic/orders";
import { getSessionStore } from "@/mocks/logic/session";

/** POST /me/orders/:id/deliver → Order (preparando → entregado) */
export const POST = mockRoute<RouteContext<"/api/mock/me/orders/[id]/deliver">>(async (request, ctx, { db, now }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(toOrder(markDelivered(findOrder(db, store.id, id), now)));
});
