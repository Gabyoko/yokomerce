import { mockRoute } from "@/mocks/http";
import { listOrders } from "@/mocks/logic/orders";
import { getSessionStore } from "@/mocks/logic/session";

/** GET /me/orders?status=&search= → Order[] */
export const GET = mockRoute((request, _ctx, { db }) => {
  const store = getSessionStore(db, request);
  const params = new URL(request.url).searchParams;
  return Response.json(listOrders(db, store.id, { status: params.get("status"), search: params.get("search") }));
});
