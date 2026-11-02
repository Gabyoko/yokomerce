import { mockRoute, readJson } from "@/mocks/http";
import { createProduct, listProducts } from "@/mocks/logic/products";
import { getSessionStore } from "@/mocks/logic/session";

/** GET /me/products → ProductAdmin[] */
export const GET = mockRoute((request, _ctx, { db }) => Response.json(listProducts(db, getSessionStore(db, request))));

/** POST /me/products → ProductAdmin (201) */
export const POST = mockRoute(async (request, _ctx, { db, now }) => {
  const store = getSessionStore(db, request);
  return Response.json(createProduct(db, store, await readJson(request), now), { status: 201 });
});
