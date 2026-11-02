import { mockRoute, readJson } from "@/mocks/http";
import { getSessionStore } from "@/mocks/logic/session";
import { listZones, saveZones } from "@/mocks/logic/stores";

/** GET /me/zones → DeliveryZone[] (también las desactivadas) */
export const GET = mockRoute((request, _ctx, { db }) => Response.json(listZones(db, getSessionStore(db, request))));

/** PUT /me/zones → DeliveryZone[] */
export const PUT = mockRoute(async (request, _ctx, { db }) => {
  const store = getSessionStore(db, request);
  return Response.json(saveZones(db, store, await readJson(request)));
});
