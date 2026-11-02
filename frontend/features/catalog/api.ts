import { apiFetch } from "@/shared/api/client";
import type { Catalog, Product } from "@/shared/types";

/** GET /public/stores/:slug — tienda, categorías, productos visibles y zonas activas. */
export function getCatalog(slug: string): Promise<Catalog> {
  return apiFetch<Catalog>(`/public/stores/${encodeURIComponent(slug)}`);
}

/** GET /public/stores/:slug/products/:id */
export function getProduct(slug: string, productId: string): Promise<Product> {
  return apiFetch<Product>(`/public/stores/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`);
}
