import type { Metadata } from "next";

import { loadCatalog } from "@/features/catalog";
import { CartReview } from "@/features/checkout";

export async function generateMetadata({ params }: PageProps<"/[slug]/carrito">): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await loadCatalog(slug);
  return { title: `Tu pedido · ${store.name}`, robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<"/[slug]/carrito">) {
  const { slug } = await params;
  const catalog = await loadCatalog(slug);
  return <CartReview catalog={catalog} />;
}
