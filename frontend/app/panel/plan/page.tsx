import type { Metadata } from "next";

import { PlanOverview } from "@/features/plans";
import { loadMyProducts } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = { title: pageTitle("Plan") };

export default async function PlanPage() {
  const [store, products] = await Promise.all([loadMyStore(), loadMyProducts()]);
  return <PlanOverview store={store} productsUsed={products.length} />;
}
