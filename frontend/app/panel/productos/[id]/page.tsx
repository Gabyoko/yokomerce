import type { Metadata } from "next";

import { loadMyCategories, loadMyProduct, ProductForm } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { pageTitle } from "@/shared/lib/brand";

type Props = PageProps<"/panel/productos/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: pageTitle((await loadMyProduct(id)).name) };
  } catch {
    return {};
  }
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const [store, product, categories] = await Promise.all([loadMyStore(), loadMyProduct(id), loadMyCategories()]);
  // key: al guardar, el formulario se actualiza con lo que devuelve la API
  return <ProductForm key={product.id} product={product} categories={categories} features={store.features} />;
}
