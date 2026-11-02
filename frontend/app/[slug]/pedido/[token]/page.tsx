import type { Metadata } from "next";

import { loadCatalog } from "@/features/catalog";
import { loadPublicOrder, OrderReady } from "@/features/checkout";
import { formatOrderNumber } from "@/shared/lib/orders";

type Props = PageProps<"/[slug]/pedido/[token]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, token } = await params;
  // El link es privado: nunca se indexa
  const robots = { index: false, follow: false };
  try {
    const [{ store }, order] = await Promise.all([loadCatalog(slug), loadPublicOrder(slug, token)]);
    return { title: `Pedido ${formatOrderNumber(order.number)} · ${store.name}`, robots };
  } catch {
    return { robots };
  }
}

export default async function OrderPage({ params }: Props) {
  const { slug, token } = await params;
  const [{ store }, order] = await Promise.all([loadCatalog(slug), loadPublicOrder(slug, token)]);
  return <OrderReady store={store} order={order} />;
}
