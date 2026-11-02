import { mockRoute } from "@/mocks/http";
import { cancelOrder, findOrder, toOrder } from "@/mocks/logic/orders";
import { getSessionStore } from "@/mocks/logic/session";

/** POST /me/orders/:id/cancel → Order (libera la reserva o devuelve el stock) */
export const POST = mockRoute<RouteContext<"/api/mock/me/orders/[id]/cancel">>(async (request, ctx, { db, now }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(toOrder(cancelOrder(db, findOrder(db, store.id, id), store.ownerName, now)));
});
