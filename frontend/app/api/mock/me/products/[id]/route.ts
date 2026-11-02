import { mockRoute, readJson } from "@/mocks/http";
import { getProductAdmin, setProductVisible, updateProduct } from "@/mocks/logic/products";
import { getSessionStore } from "@/mocks/logic/session";

type Ctx = RouteContext<"/api/mock/me/products/[id]">;

/** GET /me/products/:id → ProductAdmin */
export const GET = mockRoute<Ctx>(async (request, ctx, { db }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(getProductAdmin(db, store, id));
});

/** PUT /me/products/:id → ProductAdmin */
export const PUT = mockRoute<Ctx>(async (request, ctx, { db, now }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(updateProduct(db, store, id, await readJson(request), now));
});

/** PATCH /me/products/:id { visible } → ProductAdmin */
export const PATCH = mockRoute<Ctx>(async (request, ctx, { db }) => {
  const store = getSessionStore(db, request);
  const { id } = await ctx.params;
  return Response.json(setProductVisible(db, store, id, await readJson(request)));
});
