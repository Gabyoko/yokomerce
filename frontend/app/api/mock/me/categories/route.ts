import { mockRoute, readJson } from "@/mocks/http";
import { listCategories, saveCategories } from "@/mocks/logic/products";
import { getSessionStore } from "@/mocks/logic/session";

/** GET /me/categories → Category[] */
export const GET = mockRoute((request, _ctx, { db }) => Response.json(listCategories(db, getSessionStore(db, request))));

/** PUT /me/categories → Category[] */
export const PUT = mockRoute(async (request, _ctx, { db }) => {
  const store = getSessionStore(db, request);
  return Response.json(saveCategories(db, store, await readJson(request)));
});
