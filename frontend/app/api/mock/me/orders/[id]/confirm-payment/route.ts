import { mockRoute } from "@/mocks/http";
import { confirmPayment, findOrder, toOrder } from "@/mocks/logic/orders";
import { getSessionStore } from "@/mocks/logic/session";

/** POST /me/orders/:id/confirm-payment → Order (nuevo → pagado) */
export const POST = mockRoute<RouteContext<"/api/mock/me/orders/[id]/confirm-payment">>(
  async (request, ctx, { db, now }) => {
    const store = getSessionStore(db, request);
    const { id } = await ctx.params;
    return Response.json(toOrder(confirmPayment(db, findOrder(db, store.id, id), store.ownerName, now)));
  },
);
