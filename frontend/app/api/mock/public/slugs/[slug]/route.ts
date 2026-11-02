import { mockRoute } from "@/mocks/http";
import { checkSlug } from "@/mocks/logic/stores";

/** GET /public/slugs/:slug → { available: boolean } */
export const GET = mockRoute<RouteContext<"/api/mock/public/slugs/[slug]">>(async (_request, ctx, { db }) => {
  const { slug } = await ctx.params;
  return Response.json(checkSlug(db, slug));
});
