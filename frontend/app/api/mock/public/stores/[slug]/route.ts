import { mockRoute } from "@/mocks/http";
import { getCatalog } from "@/mocks/logic/catalog";

/** GET /public/stores/:slug → Catalog */
export const GET = mockRoute<RouteContext<"/api/mock/public/stores/[slug]">>(async (_request, ctx, { db }) => {
  const { slug } = await ctx.params;
  return Response.json(getCatalog(db, slug));
});
