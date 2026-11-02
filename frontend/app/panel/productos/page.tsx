import type { Metadata } from "next";

import { canUse, getLimit } from "@/features/plans";
import { loadMyCategories, loadMyProducts, ProductList } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = { title: pageTitle("Productos") };

export default async function ProductsPage({ searchParams }: PageProps<"/panel/productos">) {
  const [{ filtro }, store, products, categories] = await Promise.all([
    searchParams,
    loadMyStore(),
    loadMyProducts(),
    loadMyCategories(),
  ]);
  return (
    <ProductList
      key={store.id}
      products={products}
      categories={categories}
      madeToOrderEnabled={store.features.madeToOrder}
      productLimit={getLimit(store, "maxProducts")}
      canSeeHistory={canUse(store, "stockHistory")}
      initialFilter={filtro === "low" || filtro === "out" ? filtro : "all"}
    />
  );
}
