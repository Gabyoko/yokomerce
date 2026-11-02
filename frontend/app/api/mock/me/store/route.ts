import { mockRoute, readJson } from "@/mocks/http";
import { getSessionStore } from "@/mocks/logic/session";
import { createStore, toStore, updateStore } from "@/mocks/logic/stores";
import { MOCK_STORE_COOKIE } from "@/shared/api/client";

/** GET /me/store → Store */
export const GET = mockRoute((request, _ctx, { db }) => Response.json(toStore(getSessionStore(db, request))));

/**
 * POST /me/store → Store (201)
 * Fase F: no hay cuentas reales; la tienda nueva pasa a ser "la mía" con la cookie mock_store.
 */
export const POST = mockRoute(async (request, _ctx, { db }) => {
  const store = createStore(db, await readJson(request));
  const response = Response.json(toStore(store), { status: 201 });
  response.headers.append("Set-Cookie", `${MOCK_STORE_COOKIE}=${store.slug}; Path=/; SameSite=Lax; Max-Age=31536000`);
  return response;
});

/** PATCH /me/store → Store */
export const PATCH = mockRoute(async (request, _ctx, { db }) => {
  const store = getSessionStore(db, request);
  return Response.json(toStore(updateStore(store, await readJson(request))));
});
