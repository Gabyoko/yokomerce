import type { Metadata } from "next";

import { CartBar, CartPanel } from "@/features/cart";
import { CatalogBrowser, loadCatalog, StoreHeader } from "@/features/catalog";
import { StoreColumns } from "@/shared/ui/layout";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await loadCatalog(slug);
  const description = store.description || `Haz tu pedido a ${store.name} por WhatsApp.`;
  const image = store.coverUrl ?? store.logoUrl;
  return {
    title: store.name,
    description,
    openGraph: { title: store.name, description, type: "website", images: image ? [image] : undefined },
  };
}

export default async function CatalogPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const catalog = await loadCatalog(slug);

  return (
    <StoreColumns aside={<CartPanel slug={slug} products={catalog.products} />}>
      <div className="flex flex-col gap-5">
        <StoreHeader catalog={catalog} />
        <CatalogBrowser slug={slug} categories={catalog.categories} products={catalog.products} />
      </div>
      <CartBar slug={slug} products={catalog.products} />
    </StoreColumns>
  );
}
