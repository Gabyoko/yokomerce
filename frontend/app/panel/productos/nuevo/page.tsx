import type { Metadata } from "next";

import { loadMyCategories, ProductForm } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = { title: pageTitle("Nuevo producto") };

export default async function NewProductPage() {
  const [store, categories] = await Promise.all([loadMyStore(), loadMyCategories()]);
  return <ProductForm key={store.id} categories={categories} features={store.features} />;
}
