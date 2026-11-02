import { mockRoute } from "@/mocks/http";
import { getPublicProduct } from "@/mocks/logic/catalog";

/** GET /public/stores/:slug/products/:id → Product */
export const GET = mockRoute<RouteContext<"/api/mock/public/stores/[slug]/products/[productId]">>(
  async (_request, ctx, { db }) => {
    const { slug, productId } = await ctx.params;
    return Response.json(getPublicProduct(db, slug, productId));
  },
);
