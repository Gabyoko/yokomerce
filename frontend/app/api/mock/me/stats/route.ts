import { mockRoute } from "@/mocks/http";
import { getDashboardStats } from "@/mocks/logic/dashboard";
import { getSessionStore } from "@/mocks/logic/session";

/** GET /me/stats → DashboardStats */
export const GET = mockRoute((request, _ctx, { db, now }) =>
  Response.json(getDashboardStats(db, getSessionStore(db, request), now)),
);
