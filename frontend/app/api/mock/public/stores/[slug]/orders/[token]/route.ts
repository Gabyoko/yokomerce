import { mockRoute } from "@/mocks/http";
import { getPublicOrder } from "@/mocks/logic/orders";

/** GET /public/stores/:slug/orders/:token → PublicOrder */
export const GET = mockRoute<RouteContext<"/api/mock/public/stores/[slug]/orders/[token]">>(
  async (_request, ctx, { db }) => {
    const { slug, token } = await ctx.params;
    return Response.json(getPublicOrder(db, slug, token));
  },
);
