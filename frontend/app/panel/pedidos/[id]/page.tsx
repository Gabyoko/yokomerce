import type { Metadata } from "next";

import { loadMyOrder, OrderDetail, type OrderStock } from "@/features/orders";
import { loadMyProducts } from "@/features/products";
import { loadMyStore } from "@/features/store-settings";
import { formatOrderNumber } from "@/shared/lib/orders";
import { pageTitle } from "@/shared/lib/brand";

type Props = PageProps<"/panel/pedidos/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: pageTitle(`Pedido ${formatOrderNumber((await loadMyOrder(id)).number)}`) };
  } catch {
    return {};
  }
}

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  const [store, order, products] = await Promise.all([loadMyStore(), loadMyOrder(id), loadMyProducts()]);
  // Stock actual de cada variante, para mostrar "2 de 5" en lo reservado
  const stock: OrderStock = Object.fromEntries(
    products.flatMap((p) => p.variants).map((v) => [v.id, { onHand: v.onHand, reserved: v.reserved }]),
  );
  return <OrderDetail key={`${order.id}-${order.status}`} order={order} storeName={store.name} stock={stock} now={new Date().toISOString()} />;
}
