import { mockRoute, readJson } from "@/mocks/http";
import { findOrder, toOrder, updateOrderNotes } from "@/mocks/logic/orders";
import { getSessionStore } from "@/mocks/logic/session";

type Ctx = RouteContext<"/api/mock/me/orders/[id]">;

/** GET /me/orders/:id → Order */
export const GET = mockRoute<Ctx>(async (request, ctx, { db }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(toOrder(findOrder(db, store.id, id)));
});

/** PATCH /me/orders/:id { notes } → Order */
export const PATCH = mockRoute<Ctx>(async (request, ctx, { db }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  const order = findOrder(db, store.id, id);
  return Response.json(toOrder(updateOrderNotes(order, await readJson(request))));
});
