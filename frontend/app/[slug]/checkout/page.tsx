import type { Metadata } from "next";

import { loadCatalog } from "@/features/catalog";
import { CheckoutForm, deliveryDateOptions } from "@/features/checkout";
import { todayInLima } from "@/shared/lib/dates";

export async function generateMetadata({ params }: PageProps<"/[slug]/checkout">): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await loadCatalog(slug);
  return { title: `Tus datos · ${store.name}`, robots: { index: false } };
}

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[slug]/checkout">) {
  const [{ slug }, { entrega }] = await Promise.all([params, searchParams]);
  const catalog = await loadCatalog(slug);
  // Las fechas se calculan en el servidor (hora de Lima) para que no cambien al hidratar
  const now = new Date();
  return (
    <CheckoutForm
      catalog={catalog}
      dates={deliveryDateOptions(catalog.store, now)}
      today={todayInLima(now)}
      preferredFulfillment={typeof entrega === "string" ? entrega : null}
    />
  );
}
